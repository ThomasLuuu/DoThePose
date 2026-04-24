import sharp from 'sharp';
import type { SharedRgbaFrame } from './background_removal';

export interface Point {
  x: number;
  y: number;
}

export interface Line {
  start: Point;
  end: Point;
}

export interface Circle {
  center: Point;
  radius: number;
}

export interface Contour {
  points: Point[];
  isClosed: boolean;
}

export interface CompositionElements {
  horizonLine: Line | null;
  sunPosition: Circle | null;
  salientContours: Contour[];
  ruleOfThirdsLines: Line[];
}

interface HoughLine {
  rho: number;
  theta: number;
  votes: number;
}

class CompositionExtractionService {
  async extractComposition(
    imagePath: string,
    sharedRgba?: SharedRgbaFrame
  ): Promise<CompositionElements> {
    console.log('Extracting composition elements from image:', imagePath);
    
    try {
      let colorData: Buffer;
      let width: number;
      let height: number;

      if (sharedRgba) {
        colorData = sharedRgba.data;
        width = sharedRgba.width;
        height = sharedRgba.height;
      } else {
        const { data, info } = await sharp(imagePath)
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        colorData = data;
        width = info.width;
        height = info.height;
      }
      const channels = 4;

      const grayData = Buffer.alloc(width * height);
      for (let i = 0; i < width * height; i++) {
        const idx = i * channels;
        grayData[i] = Math.round(
          0.299 * colorData[idx] + 0.587 * colorData[idx + 1] + 0.114 * colorData[idx + 2]
        );
      }

      const edgeData = this.computeEdges(grayData, width, height);
      
      const horizonLine = this.detectHorizonLine(edgeData, grayData, width, height);
      const sunPosition = this.detectBrightCircle(colorData, width, height);
      const salientContours = this.extractSalientContours(edgeData, grayData, width, height);
      const ruleOfThirdsLines = this.generateRuleOfThirds(width, height);

      console.log('Composition extraction complete:', {
        hasHorizon: horizonLine !== null,
        hasSun: sunPosition !== null,
        contourCount: salientContours.length
      });

      return {
        horizonLine,
        sunPosition,
        salientContours,
        ruleOfThirdsLines
      };
    } catch (error) {
      console.error('Composition extraction failed:', error);
      return {
        horizonLine: null,
        sunPosition: null,
        salientContours: [],
        ruleOfThirdsLines: []
      };
    }
  }

  private computeEdges(data: Buffer, width: number, height: number): Buffer {
    const edges = Buffer.alloc(width * height);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        
        const gx = -data[idx - width - 1] - 2 * data[idx - 1] - data[idx + width - 1] +
                   data[idx - width + 1] + 2 * data[idx + 1] + data[idx + width + 1];
        
        const gy = -data[idx - width - 1] - 2 * data[idx - width] - data[idx - width + 1] +
                   data[idx + width - 1] + 2 * data[idx + width] + data[idx + width + 1];
        
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        edges[idx] = Math.min(255, magnitude);
      }
    }

    return edges;
  }

  private detectHorizonLine(
    edges: Buffer,
    gray: Buffer,
    width: number,
    height: number
  ): Line | null {
    const scanTop = Math.floor(height * 0.2);
    const scanBottom = Math.floor(height * 0.8);
    
    const rowScores: Array<{ y: number; score: number; colorChange: number }> = [];

    for (let y = scanTop; y < scanBottom; y++) {
      let edgeCount = 0;
      let colorSum = 0;
      let prevColorSum = 0;

      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (edges[idx] > 50) {
          edgeCount++;
        }
        colorSum += gray[idx];
        
        if (y > 0) {
          prevColorSum += gray[(y - 1) * width + x];
        }
      }

      const horizontalness = edgeCount / width;
      
      let colorChange = 0;
      if (y > 0) {
        colorChange = Math.abs(colorSum - prevColorSum) / width;
      }

      const aboveAvg = colorSum / width;
      const belowIdx = Math.min(y + 20, height - 1);
      let belowSum = 0;
      for (let x = 0; x < width; x++) {
        belowSum += gray[belowIdx * width + x];
      }
      const belowAvg = belowSum / width;
      const verticalContrast = Math.abs(aboveAvg - belowAvg);

      const score = horizontalness * 0.3 + (colorChange / 30) * 0.3 + (verticalContrast / 50) * 0.4;

      rowScores.push({ y, score, colorChange });
    }

    rowScores.sort((a, b) => b.score - a.score);
    
    const best = rowScores[0];
    if (best && best.score > 0.15) {
      let avgY = best.y;
      const nearby = rowScores.slice(0, 5).filter(r => Math.abs(r.y - best.y) < height * 0.05);
      if (nearby.length > 1) {
        avgY = Math.round(nearby.reduce((sum, r) => sum + r.y, 0) / nearby.length);
      }

      return {
        start: { x: 0, y: avgY },
        end: { x: width, y: avgY }
      };
    }

    return null;
  }

  private detectBrightCircle(
    data: Buffer,
    width: number,
    height: number
  ): Circle | null {
    const channels = 4;
    const scanHeight = Math.floor(height * 0.6);
    const windowSize = 30;
    
    let brightestX = 0;
    let brightestY = 0;
    let maxScore = 0;

    for (let y = 0; y < scanHeight; y += windowSize / 2) {
      for (let x = 0; x < width; x += windowSize / 2) {
        let brightness = 0;
        let yellowness = 0;
        let count = 0;

        for (let dy = 0; dy < windowSize && y + dy < scanHeight; dy++) {
          for (let dx = 0; dx < windowSize && x + dx < width; dx++) {
            const idx = ((y + dy) * width + (x + dx)) * channels;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            brightness += lum;
            
            if (r > 200 && g > 150 && b < 200) {
              yellowness += (r + g - b) / 3;
            }
            count++;
          }
        }

        const avgBrightness = brightness / count;
        const avgYellowness = yellowness / count;
        
        const score = avgBrightness * 0.6 + avgYellowness * 0.4;

        if (score > maxScore && avgBrightness > 200) {
          maxScore = score;
          brightestX = x + windowSize / 2;
          brightestY = y + windowSize / 2;
        }
      }
    }

    if (maxScore > 180) {
      const baseRadius = Math.min(width, height) * 0.04;
      const brightnessBonus = (maxScore - 180) / 200;
      const radius = baseRadius * (1 + brightnessBonus * 0.5);

      return {
        center: { x: brightestX, y: brightestY },
        radius: Math.max(15, Math.min(60, radius))
      };
    }

    return null;
  }

  private extractSalientContours(
    edges: Buffer,
    gray: Buffer,
    width: number,
    height: number
  ): Contour[] {
    const contours: Contour[] = [];
    const visited = new Set<number>();
    const threshold = 80;
    const minContourLength = 15;

    for (let y = 2; y < height - 2; y += 3) {
      for (let x = 2; x < width - 2; x += 3) {
        const idx = y * width + x;
        
        if (edges[idx] > threshold && !visited.has(idx)) {
          const contourPoints = this.traceContour(edges, width, height, x, y, threshold, visited);
          
          if (contourPoints.length >= minContourLength) {
            const simplified = this.simplifyContour(contourPoints, 3);
            contours.push({
              points: simplified,
              isClosed: this.isContourClosed(simplified)
            });
          }
        }
      }
    }

    contours.sort((a, b) => b.points.length - a.points.length);
    return contours.slice(0, 8);
  }

  private traceContour(
    edges: Buffer,
    width: number,
    height: number,
    startX: number,
    startY: number,
    threshold: number,
    visited: Set<number>
  ): Point[] {
    const points: Point[] = [];
    const stack: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];
    const maxPoints = 200;

    const directions = [
      { dx: 1, dy: 0 }, { dx: 1, dy: 1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 1 },
      { dx: -1, dy: 0 }, { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 }
    ];

    while (stack.length > 0 && points.length < maxPoints) {
      const { x, y } = stack.pop()!;
      const idx = y * width + x;

      if (visited.has(idx)) {
        continue;
      }
      visited.add(idx);
      points.push({ x, y });

      for (const { dx, dy } of directions) {
        const nx = x + dx;
        const ny = y + dy;
        const nidx = ny * width + nx;

        if (nx >= 0 && nx < width && ny >= 0 && ny < height &&
            !visited.has(nidx) && edges[nidx] > threshold) {
          stack.push({ x: nx, y: ny });
        }
      }
    }

    return points;
  }

  private simplifyContour(points: Point[], tolerance: number): Point[] {
    if (points.length <= 2) {
      return points;
    }

    const simplified: Point[] = [points[0]];
    let lastAdded = points[0];

    for (let i = 1; i < points.length - 1; i++) {
      const dist = Math.sqrt(
        Math.pow(points[i].x - lastAdded.x, 2) +
        Math.pow(points[i].y - lastAdded.y, 2)
      );

      if (dist >= tolerance) {
        simplified.push(points[i]);
        lastAdded = points[i];
      }
    }

    simplified.push(points[points.length - 1]);
    return simplified;
  }

  private isContourClosed(points: Point[]): boolean {
    if (points.length < 3) {
      return false;
    }

    const first = points[0];
    const last = points[points.length - 1];
    const dist = Math.sqrt(Math.pow(first.x - last.x, 2) + Math.pow(first.y - last.y, 2));

    return dist < 20;
  }

  private generateRuleOfThirds(width: number, height: number): Line[] {
    const third1X = width / 3;
    const third2X = (width * 2) / 3;
    const third1Y = height / 3;
    const third2Y = (height * 2) / 3;

    return [
      { start: { x: third1X, y: 0 }, end: { x: third1X, y: height } },
      { start: { x: third2X, y: 0 }, end: { x: third2X, y: height } },
      { start: { x: 0, y: third1Y }, end: { x: width, y: third1Y } },
      { start: { x: 0, y: third2Y }, end: { x: width, y: third2Y } }
    ];
  }
}

export const compositionExtractionService = new CompositionExtractionService();
