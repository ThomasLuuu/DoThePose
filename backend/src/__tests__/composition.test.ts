import { compositionExtractionService } from '../services/composition_extraction';

describe('CompositionExtractionService', () => {
  describe('Rule of Thirds', () => {
    it('should generate correct rule of thirds lines', () => {
      const width = 900;
      const height = 600;
      
      const lines = (compositionExtractionService as any).generateRuleOfThirds(width, height);

      expect(lines.length).toBe(4);

      const verticalLines = lines.filter((l: any) => l.start.x === l.end.x);
      expect(verticalLines.length).toBe(2);
      expect(verticalLines[0].start.x).toBe(300);
      expect(verticalLines[1].start.x).toBe(600);

      const horizontalLines = lines.filter((l: any) => l.start.y === l.end.y);
      expect(horizontalLines.length).toBe(2);
      expect(horizontalLines[0].start.y).toBe(200);
      expect(horizontalLines[1].start.y).toBe(400);
    });
  });

  describe('Contour simplification', () => {
    it('should reduce points while preserving shape', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 },
      ];

      const simplified = (compositionExtractionService as any).simplifyContour(points, 5);

      expect(simplified.length).toBeLessThan(points.length);
      expect(simplified[0]).toEqual({ x: 0, y: 0 });
      expect(simplified[simplified.length - 1]).toEqual({ x: 20, y: 0 });
    });
  });

  describe('Closed contour detection', () => {
    it('should detect closed contours', () => {
      const closedPoints = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 5, y: 5 },
      ];

      const isClosed = (compositionExtractionService as any).isContourClosed(closedPoints);
      expect(isClosed).toBe(true);
    });

    it('should detect open contours', () => {
      const openPoints = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 50, y: 200 },
      ];

      const isClosed = (compositionExtractionService as any).isContourClosed(openPoints);
      expect(isClosed).toBe(false);
    });
  });
});
