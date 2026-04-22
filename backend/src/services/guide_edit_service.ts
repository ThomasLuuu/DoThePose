import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { Guide } from '../models/guide';
import { guidesRepository } from '../repositories/guides_repository';
import { poseExtractionService } from './pose_extraction';
import { backgroundRemovalService } from './background_removal';
import { lineRenderer } from './line_renderer';

const processedDir = process.env.PROCESSED_DIR || './processed';
const uploadDir = process.env.UPLOAD_DIR || './uploads';

export type GuideEditMode = 'skeleton' | 'silhouette';

export function resolvePublicAssetPath(publicUrl: string): string {
  const base = path.basename(publicUrl);
  if (publicUrl.startsWith('/uploads/')) {
    return path.resolve(uploadDir, base);
  }
  if (publicUrl.startsWith('/processed/')) {
    return path.resolve(processedDir, base);
  }
  throw new Error(`Invalid asset URL: ${publicUrl}`);
}

export function variantPathsForGuide(guideId: string): {
  skeleton: string;
  silhouette: string;
  skeletonAbs: string;
  silhouetteAbs: string;
} {
  const abs = path.resolve(processedDir);
  return {
    skeleton: `/processed/${guideId}_skeleton.png`,
    silhouette: `/processed/${guideId}_silhouette.png`,
    skeletonAbs: path.join(abs, `${guideId}_skeleton.png`),
    silhouetteAbs: path.join(abs, `${guideId}_silhouette.png`),
  };
}

const ERASE_HISTORY_DIR = path.join(path.resolve(processedDir), '_erase_history');
const ERASE_HISTORY_MAX = 20;

function ensureHistoryDir(): void {
  if (!fs.existsSync(ERASE_HISTORY_DIR)) {
    fs.mkdirSync(ERASE_HISTORY_DIR, { recursive: true });
  }
}

type EraseStack = { undo: string[]; redo: string[] };
const eraseHistory: Map<string, EraseStack> = new Map();

function getStack(guideId: string): EraseStack {
  let stack = eraseHistory.get(guideId);
  if (!stack) {
    stack = { undo: [], redo: [] };
    eraseHistory.set(guideId, stack);
  }
  return stack;
}

async function snapshotFile(srcPath: string, guideId: string): Promise<string> {
  ensureHistoryDir();
  const name = `${guideId}_hist_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
  const dest = path.join(ERASE_HISTORY_DIR, name);
  await fs.promises.copyFile(srcPath, dest);
  return dest;
}

function trimStack(paths: string[], limit: number): void {
  while (paths.length > limit) {
    const p = paths.shift();
    if (p) {
      fs.promises.unlink(p).catch(() => {});
    }
  }
}

function dropStack(paths: string[]): void {
  for (const p of paths) {
    fs.promises.unlink(p).catch(() => {});
  }
  paths.length = 0;
}

export function deleteVariantFiles(guideId: string): void {
  const { skeletonAbs, silhouetteAbs } = variantPathsForGuide(guideId);
  for (const p of [skeletonAbs, silhouetteAbs]) {
    try {
      if (fs.existsSync(p)) {
        fs.unlinkSync(p);
      }
    } catch (e) {
      console.warn(`[guide_edit] failed to delete variant ${p}:`, e);
    }
  }
}

class GuideEditService {
  private async regenerateThumb(fullGuidePath: string, guideId: string): Promise<string> {
    const thumbPath = path.join(path.resolve(processedDir), `${guideId}_thumb.png`);
    await sharp(fullGuidePath)
      .resize(200, 200, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(thumbPath);
    return `/processed/${guideId}_thumb.png`;
  }

  async ensureVariant(
    guide: Guide,
    mode: GuideEditMode
  ): Promise<{ imageUrl: string; available: boolean; reason?: string }> {
    if (guide.status !== 'completed') {
      return { imageUrl: '', available: false, reason: 'Guide is not ready' };
    }

    const paths = variantPathsForGuide(guide.id);
    const absPath = mode === 'skeleton' ? paths.skeletonAbs : paths.silhouetteAbs;
    const relPath = mode === 'skeleton' ? paths.skeleton : paths.silhouette;

    if (fs.existsSync(absPath)) {
      return { imageUrl: relPath, available: true };
    }

    let sourcePath: string;
    try {
      sourcePath = resolvePublicAssetPath(guide.sourceImageUrl);
    } catch {
      return { imageUrl: relPath, available: false, reason: 'Missing source image' };
    }

    if (!fs.existsSync(sourcePath)) {
      return { imageUrl: relPath, available: false, reason: 'Source file not found' };
    }

    if (mode === 'skeleton') {
      return this.generateSkeleton(guide, sourcePath, absPath, relPath);
    }

    return this.generateSilhouette(sourcePath, absPath, relPath);
  }

  private async generateSkeleton(
    guide: Guide,
    sourcePath: string,
    absPath: string,
    relPath: string
  ): Promise<{ imageUrl: string; available: boolean; reason?: string }> {
    const pose = await poseExtractionService.extractPose(sourcePath);
    const strong = pose?.keypoints.filter((k) => k.confidence > 0.35) ?? [];
    if (!pose || strong.length < 4) {
      return { imageUrl: relPath, available: false, reason: 'Could not detect a pose' };
    }

    const meta = await sharp(sourcePath).metadata();
    const w = meta.width || 800;
    const h = meta.height || 600;

    await lineRenderer.renderPoseOnlyPng(absPath, pose, guide.settings, w, h);
    return { imageUrl: relPath, available: true };
  }

  private async generateSilhouette(
    sourcePath: string,
    absPath: string,
    relPath: string
  ): Promise<{ imageUrl: string; available: boolean; reason?: string }> {
    const mask = await backgroundRemovalService.removeBackground(sourcePath);
    const { width, height, data: maskData } = mask;
    const rgba = Buffer.alloc(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      const a = maskData[i] > 127 ? 255 : 0;
      rgba[i * 4] = 20;
      rgba[i * 4 + 1] = 20;
      rgba[i * 4 + 2] = 24;
      rgba[i * 4 + 3] = a;
    }

    await sharp(rgba, { raw: { width, height, channels: 4 } }).png().toFile(absPath);
    return { imageUrl: relPath, available: true };
  }

  /** Line-art: near-white pixels become transparent. Writes in place to guide PNG + refreshes thumb. */
  async cleanGuideBackground(guideId: string): Promise<Guide | null> {
    const guide = guidesRepository.findById(guideId);
    if (!guide || !guide.guideImageUrl) {
      return null;
    }

    let fullPath: string;
    try {
      fullPath = resolvePublicAssetPath(guide.guideImageUrl);
    } catch {
      return null;
    }

    if (!fs.existsSync(fullPath)) {
      return null;
    }

    const { data, info } = await sharp(fullPath)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width, height, channels } = info;
    const ch = channels === 4 ? 4 : 3;
    const out = Buffer.from(data);

    for (let i = 0; i < width * height; i++) {
      const o = i * ch;
      const r = out[o];
      const g = out[o + 1];
      const b = out[o + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum > 232 && r > 210 && g > 210 && b > 210) {
        if (ch === 4) {
          out[o + 3] = 0;
        }
      }
    }

    if (ch === 3) {
      const rgba = Buffer.alloc(width * height * 4);
      for (let i = 0; i < width * height; i++) {
        const si = i * 3;
        const di = i * 4;
        rgba[di] = out[si];
        rgba[di + 1] = out[si + 1];
        rgba[di + 2] = out[si + 2];
        const lum = 0.299 * out[si] + 0.587 * out[si + 1] + 0.114 * out[si + 2];
        const transparent = lum > 232 && out[si] > 210 && out[si + 1] > 210 && out[si + 2] > 210;
        rgba[di + 3] = transparent ? 0 : 255;
      }
      await sharp(rgba, { raw: { width, height, channels: 4 } }).png().toFile(fullPath);
    } else {
      await sharp(out, { raw: { width, height, channels: 4 } }).png().toFile(fullPath);
    }

    const thumbnailUrl = await this.regenerateThumb(fullPath, guideId);

    deleteVariantFiles(guideId);

    return guidesRepository.update(guideId, {
      guideImageUrl: guide.guideImageUrl,
      thumbnailUrl,
    });
  }

  async eraseGuideByStrokes(
    guideId: string,
    strokes: Array<Array<{ x: number; y: number }>>,
    brushSize: number
  ): Promise<{ guide: Guide; undoCount: number; redoCount: number } | null> {
    const guide = guidesRepository.findById(guideId);
    if (!guide || !guide.guideImageUrl) {
      return null;
    }

    let fullPath: string;
    try {
      fullPath = resolvePublicAssetPath(guide.guideImageUrl);
    } catch {
      return null;
    }
    if (!fs.existsSync(fullPath)) {
      return null;
    }

    const meta = await sharp(fullPath).metadata();
    const width = meta.width || 0;
    const height = meta.height || 0;
    if (width <= 0 || height <= 0) {
      return null;
    }

    const safeBrush = Math.max(4, Math.min(Number(brushSize) || 24, 120));
    const safeStrokes = (Array.isArray(strokes) ? strokes : [])
      .map((stroke) =>
        (Array.isArray(stroke) ? stroke : [])
          .map((p) => ({
            x: Number.isFinite(p?.x) ? Math.max(0, Math.min(width, p.x)) : 0,
            y: Number.isFinite(p?.y) ? Math.max(0, Math.min(height, p.y)) : 0,
          }))
          .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
      )
      .filter((stroke) => stroke.length > 0);

    const stack = getStack(guideId);

    if (safeStrokes.length === 0) {
      return { guide, undoCount: stack.undo.length, redoCount: stack.redo.length };
    }

    const snapshot = await snapshotFile(fullPath, guideId);
    stack.undo.push(snapshot);
    trimStack(stack.undo, ERASE_HISTORY_MAX);
    dropStack(stack.redo);

    const parts: string[] = [];
    for (const stroke of safeStrokes) {
      if (stroke.length === 1) {
        const p = stroke[0];
        parts.push(`<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="${(safeBrush / 2).toFixed(2)}" fill="black" />`);
        continue;
      }
      const d = stroke
        .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
        .join(' ');
      parts.push(
        `<path d="${d}" stroke="black" stroke-width="${safeBrush.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" fill="none" />`
      );
    }

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        ${parts.join('\n')}
      </svg>
    `.trim();

    const tmpPath = `${fullPath}.erase-${Date.now()}.tmp.png`;
    await sharp(fullPath)
      .ensureAlpha()
      .composite([{ input: Buffer.from(svg), blend: 'dest-out' }])
      .png()
      .toFile(tmpPath);
    await fs.promises.rename(tmpPath, fullPath);

    const thumbnailUrl = await this.regenerateThumb(fullPath, guideId);
    deleteVariantFiles(guideId);

    const updated = guidesRepository.update(guideId, {
      guideImageUrl: guide.guideImageUrl,
      thumbnailUrl,
    });
    if (!updated) {
      return null;
    }
    return { guide: updated, undoCount: stack.undo.length, redoCount: stack.redo.length };
  }

  async undoErase(guideId: string): Promise<{ guide: Guide; undoCount: number; redoCount: number } | null> {
    return this.swapHistory(guideId, 'undo');
  }

  async redoErase(guideId: string): Promise<{ guide: Guide; undoCount: number; redoCount: number } | null> {
    return this.swapHistory(guideId, 'redo');
  }

  private async swapHistory(
    guideId: string,
    direction: 'undo' | 'redo'
  ): Promise<{ guide: Guide; undoCount: number; redoCount: number } | null> {
    const guide = guidesRepository.findById(guideId);
    if (!guide || !guide.guideImageUrl) {
      return null;
    }

    let fullPath: string;
    try {
      fullPath = resolvePublicAssetPath(guide.guideImageUrl);
    } catch {
      return null;
    }
    if (!fs.existsSync(fullPath)) {
      return null;
    }

    const stack = getStack(guideId);
    const popFrom = direction === 'undo' ? stack.undo : stack.redo;
    const pushTo = direction === 'undo' ? stack.redo : stack.undo;

    const popped = popFrom.pop();
    if (!popped || !fs.existsSync(popped)) {
      return { guide, undoCount: stack.undo.length, redoCount: stack.redo.length };
    }

    const counterSnapshot = await snapshotFile(fullPath, guideId);
    pushTo.push(counterSnapshot);
    trimStack(pushTo, ERASE_HISTORY_MAX);

    await fs.promises.copyFile(popped, fullPath);
    fs.promises.unlink(popped).catch(() => {});

    const thumbnailUrl = await this.regenerateThumb(fullPath, guideId);
    deleteVariantFiles(guideId);

    const updated = guidesRepository.update(guideId, {
      guideImageUrl: guide.guideImageUrl,
      thumbnailUrl,
    });
    if (!updated) {
      return null;
    }
    return { guide: updated, undoCount: stack.undo.length, redoCount: stack.redo.length };
  }

  async replaceGuideImageFromFile(guideId: string, tempFilePath: string): Promise<Guide | null> {
    const guide = guidesRepository.findById(guideId);
    if (!guide) {
      return null;
    }

    const outDir = path.resolve(processedDir);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const destGuide = path.join(outDir, `${guideId}_guide.png`);
    const destThumb = path.join(outDir, `${guideId}_thumb.png`);

    await sharp(tempFilePath).png().toFile(destGuide);
    await sharp(destGuide)
      .resize(200, 200, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(destThumb);

    deleteVariantFiles(guideId);

    return guidesRepository.update(guideId, {
      guideImageUrl: `/processed/${guideId}_guide.png`,
      thumbnailUrl: `/processed/${guideId}_thumb.png`,
    });
  }
}

export const guideEditService = new GuideEditService();
