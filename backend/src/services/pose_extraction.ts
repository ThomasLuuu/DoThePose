import sharp from 'sharp';
import type { SharedRgbaFrame } from './background_removal';

export interface Keypoint {
  name: string;
  x: number;
  y: number;
  confidence: number;
}

export interface PoseKeypoints {
  keypoints: Keypoint[];
  connections: Array<[string, string]>;
}

const POSE_CONNECTIONS: Array<[string, string]> = [
  ['nose', 'left_eye'],
  ['nose', 'right_eye'],
  ['left_eye', 'left_ear'],
  ['right_eye', 'right_ear'],
  ['nose', 'left_shoulder'],
  ['nose', 'right_shoulder'],
  ['left_shoulder', 'right_shoulder'],
  ['left_shoulder', 'left_elbow'],
  ['right_shoulder', 'right_elbow'],
  ['left_elbow', 'left_wrist'],
  ['right_elbow', 'right_wrist'],
  ['left_shoulder', 'left_hip'],
  ['right_shoulder', 'right_hip'],
  ['left_hip', 'right_hip'],
  ['left_hip', 'left_knee'],
  ['right_hip', 'right_knee'],
  ['left_knee', 'left_ankle'],
  ['right_knee', 'right_ankle']
];

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

class PoseExtractionService {
  async extractPose(
    imagePath: string,
    sharedRgba?: SharedRgbaFrame
  ): Promise<PoseKeypoints | null> {
    console.log('Extracting pose from image:', imagePath);
    
    try {
      let width: number;
      let height: number;
      let data: Buffer;

      if (sharedRgba) {
        width = sharedRgba.width;
        height = sharedRgba.height;
        data = sharedRgba.data;
      } else {
        const metadata = await sharp(imagePath).metadata();
        width = metadata.width || 800;
        height = metadata.height || 600;

        const raw = await sharp(imagePath)
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        data = raw.data;
      }

      const personBbox = await this.detectPerson(data, width, height);
      
      if (!personBbox) {
        console.log('No person detected in image');
        return null;
      }

      const keypoints = this.estimateKeypoints(personBbox, width, height);
      
      const validKeypoints = keypoints.filter(kp => kp.confidence > 0.3);
      console.log(`Pose extraction complete: ${validKeypoints.length} keypoints detected`);
      
      return {
        keypoints,
        connections: POSE_CONNECTIONS
      };
    } catch (error) {
      console.error('Pose extraction failed:', error);
      return null;
    }
  }

  private async detectPerson(
    imageData: Buffer,
    width: number,
    height: number
  ): Promise<BoundingBox | null> {
    const channels = 4;
    const skinPixels: Array<{ x: number; y: number }> = [];
    const sampleStep = 4;

    for (let y = 0; y < height; y += sampleStep) {
      for (let x = 0; x < width; x += sampleStep) {
        const idx = (y * width + x) * channels;
        const r = imageData[idx];
        const g = imageData[idx + 1];
        const b = imageData[idx + 2];

        if (this.isSkinColor(r, g, b)) {
          skinPixels.push({ x, y });
        }
      }
    }

    if (skinPixels.length < 50) {
      return this.detectByEdgeDensity(imageData, width, height, channels);
    }

    let minX = width, maxX = 0, minY = height, maxY = 0;
    for (const pixel of skinPixels) {
      minX = Math.min(minX, pixel.x);
      maxX = Math.max(maxX, pixel.x);
      minY = Math.min(minY, pixel.y);
      maxY = Math.max(maxY, pixel.y);
    }

    const padding = Math.max(width, height) * 0.1;
    minX = Math.max(0, minX - padding);
    maxX = Math.min(width, maxX + padding);
    minY = Math.max(0, minY - padding * 2);
    maxY = Math.min(height, maxY + padding);

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  private detectByEdgeDensity(
    data: Buffer,
    width: number,
    height: number,
    channels: number
  ): BoundingBox | null {
    const gridSize = 8;
    const cellWidth = Math.floor(width / gridSize);
    const cellHeight = Math.floor(height / gridSize);
    const densities: number[][] = [];

    for (let gy = 0; gy < gridSize; gy++) {
      densities[gy] = [];
      for (let gx = 0; gx < gridSize; gx++) {
        let edgeSum = 0;
        let count = 0;

        for (let y = gy * cellHeight; y < (gy + 1) * cellHeight && y < height - 1; y += 2) {
          for (let x = gx * cellWidth; x < (gx + 1) * cellWidth && x < width - 1; x += 2) {
            const idx = (y * width + x) * channels;
            const idxRight = idx + channels;
            const idxDown = ((y + 1) * width + x) * channels;

            const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
            const grayRight = 0.299 * data[idxRight] + 0.587 * data[idxRight + 1] + 0.114 * data[idxRight + 2];
            const grayDown = 0.299 * data[idxDown] + 0.587 * data[idxDown + 1] + 0.114 * data[idxDown + 2];

            edgeSum += Math.abs(gray - grayRight) + Math.abs(gray - grayDown);
            count++;
          }
        }

        densities[gy][gx] = count > 0 ? edgeSum / count : 0;
      }
    }

    const threshold = 20;
    let minGx = gridSize, maxGx = 0, minGy = gridSize, maxGy = 0;
    let found = false;

    for (let gy = 0; gy < gridSize; gy++) {
      for (let gx = 0; gx < gridSize; gx++) {
        if (densities[gy][gx] > threshold) {
          minGx = Math.min(minGx, gx);
          maxGx = Math.max(maxGx, gx);
          minGy = Math.min(minGy, gy);
          maxGy = Math.max(maxGy, gy);
          found = true;
        }
      }
    }

    if (!found) {
      return {
        x: width * 0.2,
        y: height * 0.1,
        width: width * 0.6,
        height: height * 0.8
      };
    }

    return {
      x: minGx * cellWidth,
      y: minGy * cellHeight,
      width: (maxGx - minGx + 1) * cellWidth,
      height: (maxGy - minGy + 1) * cellHeight
    };
  }

  private isSkinColor(r: number, g: number, b: number): boolean {
    const uniformity = Math.max(r, g, b) - Math.min(r, g, b) < 80;
    const notTooLight = r < 250 && g < 250 && b < 250;
    const notTooDark = r > 40 && g > 30 && b > 20;
    const rDominant = r > g && r > b;
    const reasonableBlue = b < r * 0.9;

    return uniformity && notTooLight && notTooDark && rDominant && reasonableBlue;
  }

  private estimateKeypoints(bbox: BoundingBox, imgWidth: number, imgHeight: number): Keypoint[] {
    const { x, y, width, height } = bbox;
    const centerX = x + width / 2;

    const headHeight = height * 0.12;
    const torsoHeight = height * 0.35;
    const legHeight = height * 0.45;
    
    const shoulderWidth = width * 0.4;
    const hipWidth = width * 0.25;

    const template: Array<{ name: string; rx: number; ry: number; conf: number }> = [
      { name: 'nose', rx: 0, ry: 0.04, conf: 0.9 },
      { name: 'left_eye', rx: -0.03, ry: 0.02, conf: 0.85 },
      { name: 'right_eye', rx: 0.03, ry: 0.02, conf: 0.85 },
      { name: 'left_ear', rx: -0.06, ry: 0.04, conf: 0.7 },
      { name: 'right_ear', rx: 0.06, ry: 0.04, conf: 0.7 },
      { name: 'left_shoulder', rx: -0.2, ry: 0.15, conf: 0.9 },
      { name: 'right_shoulder', rx: 0.2, ry: 0.15, conf: 0.9 },
      { name: 'left_elbow', rx: -0.28, ry: 0.32, conf: 0.8 },
      { name: 'right_elbow', rx: 0.28, ry: 0.32, conf: 0.8 },
      { name: 'left_wrist', rx: -0.32, ry: 0.48, conf: 0.75 },
      { name: 'right_wrist', rx: 0.32, ry: 0.48, conf: 0.75 },
      { name: 'left_hip', rx: -0.1, ry: 0.52, conf: 0.9 },
      { name: 'right_hip', rx: 0.1, ry: 0.52, conf: 0.9 },
      { name: 'left_knee', rx: -0.12, ry: 0.75, conf: 0.85 },
      { name: 'right_knee', rx: 0.12, ry: 0.75, conf: 0.85 },
      { name: 'left_ankle', rx: -0.12, ry: 0.95, conf: 0.8 },
      { name: 'right_ankle', rx: 0.12, ry: 0.95, conf: 0.8 }
    ];

    return template.map(pt => {
      const kpX = centerX + pt.rx * width;
      const kpY = y + pt.ry * height;

      const inBoundsX = kpX >= 0 && kpX < imgWidth;
      const inBoundsY = kpY >= 0 && kpY < imgHeight;
      const confidence = (inBoundsX && inBoundsY) ? pt.conf : pt.conf * 0.5;

      return {
        name: pt.name,
        x: Math.max(0, Math.min(imgWidth - 1, kpX)),
        y: Math.max(0, Math.min(imgHeight - 1, kpY)),
        confidence
      };
    });
  }
}

export const poseExtractionService = new PoseExtractionService();
