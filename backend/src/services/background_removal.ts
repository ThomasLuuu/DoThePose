import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

export interface ForegroundMask {
  width: number;
  height: number;
  data: Buffer;
}

class BackgroundRemovalService {
  private modelLoaded = false;

  async removeBackground(imagePath: string): Promise<ForegroundMask> {
    console.log('Removing background from image:', imagePath);
    
    try {
      const image = sharp(imagePath);
      const metadata = await image.metadata();
      const width = metadata.width || 800;
      const height = metadata.height || 600;

      const { data } = await image
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const maskData = await this.computeSegmentationMask(data, width, height);
      
      console.log(`Background removal complete: ${width}x${height}`);

      return {
        width,
        height,
        data: maskData
      };
    } catch (error) {
      console.error('Background removal failed, creating edge-based fallback:', error);
      return this.createEdgeBasedMask(imagePath);
    }
  }

  private async computeSegmentationMask(
    imageData: Buffer,
    width: number,
    height: number
  ): Promise<Buffer> {
    const maskData = Buffer.alloc(width * height);
    const channels = 4;

    const grayBuf = Buffer.alloc(width * height);
    for (let i = 0; i < width * height; i++) {
      const idx = i * channels;
      grayBuf[i] = Math.round(
        0.299 * imageData[idx] + 0.587 * imageData[idx + 1] + 0.114 * imageData[idx + 2]
      );
    }

    const edgeMag = Buffer.alloc(width * height);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const gx =
          -grayBuf[idx - width - 1] - 2 * grayBuf[idx - 1] - grayBuf[idx + width - 1] +
          grayBuf[idx - width + 1] + 2 * grayBuf[idx + 1] + grayBuf[idx + width + 1];
        const gy =
          -grayBuf[idx - width - 1] - 2 * grayBuf[idx - width] - grayBuf[idx - width + 1] +
          grayBuf[idx + width - 1] + 2 * grayBuf[idx + width] + grayBuf[idx + width + 1];
        edgeMag[idx] = Math.min(255, Math.round(Math.sqrt(gx * gx + gy * gy)));
      }
    }

    const centerX = width / 2;
    const centerY = height / 2;
    const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
    const yLow = height * 0.1;
    const yHigh = height * 0.9;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIdx = (y * width + x) * channels;
        const maskIdx = y * width + x;

        const r = imageData[pixelIdx];
        const g = imageData[pixelIdx + 1];
        const b = imageData[pixelIdx + 2];

        const luminance = grayBuf[maskIdx];

        const dx = x - centerX;
        const dy = y - centerY;
        const distFromCenter = Math.sqrt(dx * dx + dy * dy);
        const centerWeight = 1 - (distFromCenter / maxDist) * 0.5;

        const isSkin = this.detectSkinTone(r, g, b);
        const skinBoost = isSkin ? 0.3 : 0;

        const verticalWeight = y > yLow && y < yHigh ? 0.1 : 0;

        let score = centerWeight * 0.4 + (luminance / 255) * 0.2 + skinBoost + verticalWeight;

        if (edgeMag[maskIdx] > 50) {
          score += 0.2;
        }

        maskData[maskIdx] = score > 0.45 ? 255 : 0;
      }
    }

    return this.refineMask(maskData, width, height);
  }

  private detectSkinTone(r: number, g: number, b: number): boolean {
    const isRgbSkin = r > 95 && g > 40 && b > 20 &&
                      Math.max(r, g, b) - Math.min(r, g, b) > 15 &&
                      Math.abs(r - g) > 15 && r > g && r > b;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2 / 255;
    
    let h = 0;
    if (max !== min) {
      const d = max - min;
      if (max === r) {
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      } else if (max === g) {
        h = ((b - r) / d + 2) / 6;
      } else {
        h = ((r - g) / d + 4) / 6;
      }
    }
    
    const isHslSkin = h >= 0 && h <= 0.1 && l >= 0.2 && l <= 0.85;
    
    return isRgbSkin || isHslSkin;
  }

  private computeLocalEdge(
    data: Buffer,
    x: number,
    y: number,
    width: number,
    height: number,
    channels: number
  ): number {
    if (x <= 0 || x >= width - 1 || y <= 0 || y >= height - 1) {
      return 0;
    }

    const getGray = (px: number, py: number): number => {
      const idx = (py * width + px) * channels;
      return 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    };

    const gx = -getGray(x - 1, y - 1) - 2 * getGray(x - 1, y) - getGray(x - 1, y + 1) +
               getGray(x + 1, y - 1) + 2 * getGray(x + 1, y) + getGray(x + 1, y + 1);
    
    const gy = -getGray(x - 1, y - 1) - 2 * getGray(x, y - 1) - getGray(x + 1, y - 1) +
               getGray(x - 1, y + 1) + 2 * getGray(x, y + 1) + getGray(x + 1, y + 1);

    return Math.sqrt(gx * gx + gy * gy);
  }

  private refineMask(mask: Buffer, width: number, height: number): Buffer {
    const refined = Buffer.from(mask);
    const kernelSize = 3;
    const halfKernel = Math.floor(kernelSize / 2);

    for (let y = halfKernel; y < height - halfKernel; y++) {
      for (let x = halfKernel; x < width - halfKernel; x++) {
        let count = 0;
        for (let ky = -halfKernel; ky <= halfKernel; ky++) {
          for (let kx = -halfKernel; kx <= halfKernel; kx++) {
            if (mask[(y + ky) * width + (x + kx)] > 127) {
              count++;
            }
          }
        }
        refined[y * width + x] = count >= 5 ? 255 : 0;
      }
    }

    return refined;
  }

  private async createEdgeBasedMask(imagePath: string): Promise<ForegroundMask> {
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    const width = metadata.width || 800;
    const height = metadata.height || 600;

    const { data } = await image
      .greyscale()
      .convolve({
        width: 3,
        height: 3,
        kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1]
      })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const maskData = Buffer.alloc(width * height);
    for (let i = 0; i < data.length; i++) {
      maskData[i] = data[i] > 30 ? 255 : 0;
    }

    return { width, height, data: maskData };
  }
}

export const backgroundRemovalService = new BackgroundRemovalService();
