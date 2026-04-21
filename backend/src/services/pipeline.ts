import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { GuideSettings, GuideLayers, ProcessingResult } from '../models/guide';
import { backgroundRemovalService } from './background_removal';
import { poseExtractionService, PoseKeypoints } from './pose_extraction';
import { compositionExtractionService, CompositionElements } from './composition_extraction';
import { fetchLineArt } from './gradio_line_art';
import { lineRenderer } from './line_renderer';
import { telemetry } from '../utils/telemetry';

const processedDir = process.env.PROCESSED_DIR || './processed';
const MAX_DIMENSION = 1280;

class ProcessingPipeline {
  private async normalizeImage(imagePath: string): Promise<string> {
    const metadata = await sharp(imagePath).metadata();
    const w = metadata.width || 0;
    const h = metadata.height || 0;
    console.log(`[PIPELINE] Original image: ${w}x${h}`);

    if (w <= MAX_DIMENSION && h <= MAX_DIMENSION) {
      return imagePath;
    }

    const normalizedPath = imagePath.replace(/(\.\w+)$/, '_norm$1');
    await sharp(imagePath)
      .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toFile(normalizedPath);

    const meta2 = await sharp(normalizedPath).metadata();
    console.log(`[PIPELINE] Normalized image: ${meta2.width}x${meta2.height}`);
    return normalizedPath;
  }

  async process(
    guideId: string,
    imagePath: string,
    settings: GuideSettings
  ): Promise<ProcessingResult> {
    const metric = telemetry.startProcessing(guideId);
    const startTime = Date.now();
    console.log(`[PIPELINE] Starting processing for guide ${guideId}`);

    imagePath = await this.normalizeImage(imagePath);

    const outputDir = path.resolve(processedDir);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const guideImagePath = `/processed/${guideId}_guide.png`;
    const thumbnailPath = `/processed/${guideId}_thumb.png`;
    const fullGuidePath = path.join(outputDir, `${guideId}_guide.png`);
    const fullThumbPath = path.join(outputDir, `${guideId}_thumb.png`);

    const usePortraitMode = settings.style === 'portrait_minimal' ||
                            settings.style === 'portrait_moderate' ||
                            settings.style === 'portrait_detailed' ||
                            settings.style === undefined;

    if (usePortraitMode) {
      const result = await this.processPortraitMode(
        guideId, imagePath, settings, metric, fullGuidePath, fullThumbPath
      );
      if (result) {
        const processingTimeMs = Date.now() - startTime;
        telemetry.completeProcessing(metric, true);
        console.log(`[PIPELINE] Portrait processing completed for guide ${guideId} in ${processingTimeMs}ms`);
        return {
          guideImagePath,
          thumbnailPath,
          detectedLayers: result.detectedLayers,
          processingTimeMs
        };
      }
      console.log('[PIPELINE] Portrait mode failed, falling back to legacy mode');
    }

    const result = await this.processLegacyMode(
      guideId, imagePath, settings, metric, fullGuidePath, fullThumbPath
    );

    const processingTimeMs = Date.now() - startTime;
    telemetry.completeProcessing(metric, true);
    console.log(`[PIPELINE] Processing completed for guide ${guideId} in ${processingTimeMs}ms`);

    return {
      guideImagePath,
      thumbnailPath,
      detectedLayers: result.detectedLayers,
      processingTimeMs
    };
  }

  private async processPortraitMode(
    guideId: string,
    imagePath: string,
    settings: GuideSettings,
    metric: any,
    fullGuidePath: string,
    fullThumbPath: string
  ): Promise<{ detectedLayers: GuideLayers } | null> {
    try {
      const portraitStart = Date.now();
      console.log(`[PIPELINE] Starting Gradio line-art extraction for guide ${guideId}`);

      const lineArtBuffer = await fetchLineArt(imagePath, settings.style);

      console.log(`[PIPELINE] gradio_line_art: ${Date.now() - portraitStart}ms`);
      telemetry.recordStage(metric, 'gradio_line_art', true, portraitStart, {
        usedGradio: true,
        styleVersion: settings.style || 'portrait_minimal',
      });

      const renderStart = Date.now();
      await sharp(lineArtBuffer).png().toFile(fullGuidePath);
      await sharp(lineArtBuffer)
        .resize(200, 200, { fit: 'inside', background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .png()
        .toFile(fullThumbPath);
      console.log(`[PIPELINE] portrait_rendering: ${Date.now() - renderStart}ms`);
      telemetry.recordStage(metric, 'portrait_rendering', true, renderStart);

      const detectedLayers: GuideLayers = {
        pose: false,
        horizon: false,
        sun: false,
        composition: true,
      };

      return { detectedLayers };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[PIPELINE] Gradio line-art processing failed:', errorMsg);
      telemetry.recordStage(metric, 'gradio_line_art', false, Date.now(), {
        error: errorMsg,
      });
      return null;
    }
  }

  private async processLegacyMode(
    guideId: string,
    imagePath: string,
    settings: GuideSettings,
    metric: any,
    fullGuidePath: string,
    fullThumbPath: string
  ): Promise<{ detectedLayers: GuideLayers }> {
    let foregroundMask, poseKeypoints, compositionElements;

    const parallelStart = Date.now();
    const [bgResult, poseResult, compResult] = await Promise.allSettled([
      (async () => {
        const bgStart = Date.now();
        const mask = await backgroundRemovalService.removeBackground(imagePath);
        console.log(`[PIPELINE] background_removal: ${Date.now() - bgStart}ms`);
        telemetry.recordStage(metric, 'background_removal', true, bgStart);
        return mask;
      })(),
      (async () => {
        const poseStart = Date.now();
        const kp = await poseExtractionService.extractPose(imagePath);
        console.log(`[PIPELINE] pose_extraction: ${Date.now() - poseStart}ms`);
        telemetry.recordStage(metric, 'pose_extraction', true, poseStart, {
          keypointsCount: kp?.keypoints.length || 0,
        });
        return kp;
      })(),
      (async () => {
        const compStart = Date.now();
        const ce = await compositionExtractionService.extractComposition(imagePath);
        console.log(`[PIPELINE] composition_extraction: ${Date.now() - compStart}ms`);
        telemetry.recordStage(metric, 'composition_extraction', true, compStart, {
          hasHorizon: ce.horizonLine !== null,
          hasSun: ce.sunPosition !== null,
        });
        return ce;
      })(),
    ]);
    console.log(`[PIPELINE] parallel stages total wall time: ${Date.now() - parallelStart}ms`);

    if (bgResult.status === 'fulfilled') {
      foregroundMask = bgResult.value;
    } else {
      telemetry.recordStage(metric, 'background_removal', false, Date.now());
      throw bgResult.reason;
    }

    if (poseResult.status === 'fulfilled') {
      poseKeypoints = poseResult.value;
    } else {
      telemetry.recordStage(metric, 'pose_extraction', false, Date.now());
      poseKeypoints = null;
    }

    if (compResult.status === 'fulfilled') {
      compositionElements = compResult.value;
    } else {
      telemetry.recordStage(metric, 'composition_extraction', false, Date.now());
      compositionElements = {
        horizonLine: null,
        sunPosition: null,
        salientContours: [],
        ruleOfThirdsLines: [],
      };
    }

    const detectedLayers: GuideLayers = {
      pose: poseKeypoints !== null && poseKeypoints.keypoints.length > 0,
      horizon: compositionElements.horizonLine !== null,
      sun: compositionElements.sunPosition !== null,
      composition: compositionElements.salientContours.length > 0
    };

    console.log('Detected layers:', detectedLayers);

    try {
      const renderStart = Date.now();
      await lineRenderer.render({
        outputPath: fullGuidePath,
        thumbnailPath: fullThumbPath,
        sourceImagePath: imagePath,
        foregroundMask,
        poseKeypoints,
        compositionElements,
        settings
      });
      console.log(`[PIPELINE] line_rendering: ${Date.now() - renderStart}ms`);
      telemetry.recordStage(metric, 'line_rendering', true, renderStart);
    } catch (error) {
      telemetry.recordStage(metric, 'line_rendering', false, Date.now());
      throw error;
    }

    return { detectedLayers };
  }
}

export const processingPipeline = new ProcessingPipeline();
