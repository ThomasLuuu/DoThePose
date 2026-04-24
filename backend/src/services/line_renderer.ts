import sharp from 'sharp';
import { GuideSettings } from '../models/guide';
import { ForegroundMask } from './background_removal';
import { PoseKeypoints } from './pose_extraction';
import { CompositionElements, Point } from './composition_extraction';

interface RenderOptions {
  outputPath: string;
  thumbnailPath: string;
  sourceImagePath: string;
  foregroundMask: ForegroundMask;
  poseKeypoints: PoseKeypoints | null;
  compositionElements: CompositionElements;
  settings: GuideSettings;
}

interface LayerConfig {
  strokeColor: string;
  strokeWidth: number;
  opacity: number;
}

class LineRenderer {
  async render(options: RenderOptions): Promise<void> {
    const {
      outputPath,
      thumbnailPath,
      sourceImagePath,
      foregroundMask,
      poseKeypoints,
      compositionElements,
      settings
    } = options;

    console.log('Rendering line guide with settings:', settings);

    const metadata = await sharp(sourceImagePath).metadata();
    const width = metadata.width || foregroundMask.width;
    const height = metadata.height || foregroundMask.height;

    const poseLayer = this.renderPoseLayer(poseKeypoints, settings, width, height);
    const compositionLayer = this.renderCompositionLayer(compositionElements, settings, width, height);
    const guideLayer = this.renderRuleOfThirds(compositionElements.ruleOfThirdsLines, settings, width, height);

    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <rect width="100%" height="100%" fill="transparent"/>
        <g id="guide-layer" opacity="${settings.opacity * 0.3}">
          ${guideLayer}
        </g>
        <g id="composition-layer" opacity="${settings.opacity * 0.8}">
          ${compositionLayer}
        </g>
        <g id="pose-layer" opacity="${settings.opacity}" filter="url(#glow)">
          ${poseLayer}
        </g>
      </svg>
    `.trim();

    await sharp(Buffer.from(svg))
      .png()
      .toFile(outputPath);

    console.log('Guide image saved:', outputPath);

    await sharp(outputPath)
      .resize(200, 200, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(thumbnailPath);

    console.log('Thumbnail saved:', thumbnailPath);
  }

  /** Pose stick figure only (transparent background), for Edit Guide skeleton mode. */
  async renderPoseOnlyPng(
    outputPath: string,
    pose: PoseKeypoints | null,
    settings: GuideSettings,
    width: number,
    height: number
  ): Promise<void> {
    const poseLayer = this.renderPoseLayer(pose, settings, width, height);
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="transparent"/>
        <g id="pose-layer" opacity="${settings.opacity}">
          ${poseLayer}
        </g>
      </svg>
    `.trim();

    await sharp(Buffer.from(svg)).png().toFile(outputPath);
  }

  private renderPoseLayer(
    pose: PoseKeypoints | null,
    settings: GuideSettings,
    width: number,
    height: number
  ): string {
    if (!pose || pose.keypoints.length === 0) {
      return '';
    }

    const svgElements: string[] = [];
    const strokeWidth = settings.strokeWidth;
    
    const keypointMap = new Map(pose.keypoints.map(kp => [kp.name, kp]));

    const boneGroups: { connections: Array<[string, string]>; color: string }[] = [
      {
        connections: [['left_shoulder', 'right_shoulder'], ['left_hip', 'right_hip']],
        color: 'rgba(255, 255, 255, 0.9)'
      },
      {
        connections: [['left_shoulder', 'left_hip'], ['right_shoulder', 'right_hip']],
        color: 'rgba(255, 255, 255, 0.85)'
      },
      {
        connections: [['left_shoulder', 'left_elbow'], ['left_elbow', 'left_wrist']],
        color: 'rgba(200, 220, 255, 0.8)'
      },
      {
        connections: [['right_shoulder', 'right_elbow'], ['right_elbow', 'right_wrist']],
        color: 'rgba(200, 220, 255, 0.8)'
      },
      {
        connections: [['left_hip', 'left_knee'], ['left_knee', 'left_ankle']],
        color: 'rgba(180, 200, 255, 0.8)'
      },
      {
        connections: [['right_hip', 'right_knee'], ['right_knee', 'right_ankle']],
        color: 'rgba(180, 200, 255, 0.8)'
      },
      {
        connections: [
          ['nose', 'left_eye'], ['nose', 'right_eye'],
          ['left_eye', 'left_ear'], ['right_eye', 'right_ear'],
          ['nose', 'left_shoulder'], ['nose', 'right_shoulder']
        ],
        color: 'rgba(255, 230, 200, 0.7)'
      }
    ];

    for (const group of boneGroups) {
      for (const [startName, endName] of group.connections) {
        const start = keypointMap.get(startName);
        const end = keypointMap.get(endName);

        if (start && end && start.confidence > 0.4 && end.confidence > 0.4) {
          const avgConf = (start.confidence + end.confidence) / 2;
          const lineWidth = strokeWidth * (0.8 + avgConf * 0.4);

          svgElements.push(
            `<line x1="${start.x.toFixed(1)}" y1="${start.y.toFixed(1)}" ` +
            `x2="${end.x.toFixed(1)}" y2="${end.y.toFixed(1)}" ` +
            `stroke="${group.color}" stroke-width="${lineWidth.toFixed(1)}" ` +
            `stroke-linecap="round"/>`
          );
        }
      }
    }

    const jointColors: { [key: string]: string } = {
      'nose': 'rgba(255, 220, 180, 0.9)',
      'left_eye': 'rgba(255, 220, 180, 0.8)',
      'right_eye': 'rgba(255, 220, 180, 0.8)',
      'left_shoulder': 'rgba(255, 255, 255, 0.95)',
      'right_shoulder': 'rgba(255, 255, 255, 0.95)',
      'left_hip': 'rgba(255, 255, 255, 0.95)',
      'right_hip': 'rgba(255, 255, 255, 0.95)',
      'left_wrist': 'rgba(200, 220, 255, 0.9)',
      'right_wrist': 'rgba(200, 220, 255, 0.9)',
      'left_ankle': 'rgba(180, 200, 255, 0.9)',
      'right_ankle': 'rgba(180, 200, 255, 0.9)'
    };

    for (const kp of pose.keypoints) {
      if (kp.confidence > 0.4) {
        const radius = strokeWidth * (1.2 + kp.confidence * 0.6);
        const color = jointColors[kp.name] || 'rgba(255, 255, 255, 0.8)';

        svgElements.push(
          `<circle cx="${kp.x.toFixed(1)}" cy="${kp.y.toFixed(1)}" r="${radius.toFixed(1)}" ` +
          `fill="${color}"/>`
        );
      }
    }

    return svgElements.join('\n        ');
  }

  private renderCompositionLayer(
    elements: CompositionElements,
    settings: GuideSettings,
    width: number,
    height: number
  ): string {
    const svgElements: string[] = [];
    const strokeWidth = settings.strokeWidth;

    if (elements.horizonLine) {
      const { start, end } = elements.horizonLine;
      svgElements.push(
        `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" ` +
        `stroke="rgba(100, 200, 255, 0.7)" stroke-width="${strokeWidth * 1.5}" ` +
        `stroke-dasharray="15,8" stroke-linecap="round"/>`
      );

      svgElements.push(
        `<text x="${width - 10}" y="${start.y - 8}" ` +
        `fill="rgba(100, 200, 255, 0.5)" font-size="12" text-anchor="end" ` +
        `font-family="sans-serif">horizon</text>`
      );
    }

    if (elements.sunPosition) {
      const { center, radius } = elements.sunPosition;
      
      svgElements.push(
        `<circle cx="${center.x}" cy="${center.y}" r="${radius}" ` +
        `fill="none" stroke="rgba(255, 220, 100, 0.8)" stroke-width="${strokeWidth}"/>`
      );

      const innerRadius = radius * 0.6;
      svgElements.push(
        `<circle cx="${center.x}" cy="${center.y}" r="${innerRadius}" ` +
        `fill="rgba(255, 240, 150, 0.3)" stroke="none"/>`
      );

      const rayCount = 12;
      const rayInner = radius * 1.1;
      const rayOuter = radius * 1.6;
      
      for (let i = 0; i < rayCount; i++) {
        const angle = (i * 360 / rayCount) * Math.PI / 180;
        const x1 = center.x + rayInner * Math.cos(angle);
        const y1 = center.y + rayInner * Math.sin(angle);
        const x2 = center.x + rayOuter * Math.cos(angle);
        const y2 = center.y + rayOuter * Math.sin(angle);
        
        svgElements.push(
          `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" ` +
          `x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" ` +
          `stroke="rgba(255, 220, 100, 0.5)" stroke-width="${strokeWidth * 0.5}" ` +
          `stroke-linecap="round"/>`
        );
      }
    }

    for (const contour of elements.salientContours) {
      if (contour.points.length > 2) {
        const pathData = this.pointsToSmoothPath(contour.points, contour.isClosed);
        svgElements.push(
          `<path d="${pathData}" fill="none" ` +
          `stroke="rgba(150, 180, 220, 0.5)" stroke-width="${strokeWidth * 0.6}" ` +
          `stroke-linecap="round" stroke-linejoin="round"/>`
        );
      }
    }

    return svgElements.join('\n        ');
  }

  private renderRuleOfThirds(
    lines: { start: Point; end: Point }[],
    settings: GuideSettings,
    width: number,
    height: number
  ): string {
    const svgElements: string[] = [];

    for (const line of lines) {
      svgElements.push(
        `<line x1="${line.start.x}" y1="${line.start.y}" ` +
        `x2="${line.end.x}" y2="${line.end.y}" ` +
        `stroke="rgba(255, 255, 255, 0.15)" stroke-width="1" ` +
        `stroke-dasharray="5,15"/>`
      );
    }

    const intersections = [
      { x: width / 3, y: height / 3 },
      { x: width * 2 / 3, y: height / 3 },
      { x: width / 3, y: height * 2 / 3 },
      { x: width * 2 / 3, y: height * 2 / 3 }
    ];

    for (const point of intersections) {
      svgElements.push(
        `<circle cx="${point.x}" cy="${point.y}" r="4" ` +
        `fill="none" stroke="rgba(255, 255, 255, 0.2)" stroke-width="1"/>`
      );
    }

    return svgElements.join('\n        ');
  }

  private pointsToSmoothPath(points: Point[], closed: boolean): string {
    if (points.length < 2) {
      return '';
    }

    if (points.length === 2) {
      return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
    }

    let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];

      const cp1x = prev.x + (curr.x - prev.x) * 0.5;
      const cp1y = prev.y + (curr.y - prev.y) * 0.5;
      const cp2x = curr.x - (next.x - prev.x) * 0.15;
      const cp2y = curr.y - (next.y - prev.y) * 0.15;

      path += ` Q ${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
    }

    const last = points[points.length - 1];
    path += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;

    if (closed) {
      path += ' Z';
    }

    return path;
  }
}

export const lineRenderer = new LineRenderer();
