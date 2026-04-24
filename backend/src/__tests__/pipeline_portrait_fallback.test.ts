import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { v4 as uuid } from 'uuid';

jest.mock('../services/line_art_onnx', () => ({
  fetchLineArt: jest.fn().mockRejectedValue(new Error('onnx unavailable')),
  resetLineArtOnnxSessionForTests: jest.fn(),
}));

jest.mock('../services/background_removal', () => ({
  backgroundRemovalService: {
    removeBackground: jest.fn().mockResolvedValue({
      width: 4,
      height: 4,
      data: Buffer.alloc(16, 255),
    }),
  },
}));

jest.mock('../services/pose_extraction', () => ({
  poseExtractionService: {
    extractPose: jest.fn().mockResolvedValue({ keypoints: [] }),
  },
}));

jest.mock('../services/composition_extraction', () => ({
  compositionExtractionService: {
    extractComposition: jest.fn().mockResolvedValue({
      horizonLine: null,
      sunPosition: null,
      salientContours: [],
      ruleOfThirdsLines: [],
    }),
  },
}));

jest.mock('../services/line_renderer', () => ({
  lineRenderer: {
    render: jest.fn().mockImplementation(
      async ({
        outputPath,
        thumbnailPath,
      }: {
        outputPath: string;
        thumbnailPath: string;
      }) => {
        await sharp({
          create: {
            width: 8,
            height: 8,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          },
        })
          .png()
          .toFile(outputPath);
        await sharp(outputPath)
          .resize(200, 200, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toFile(thumbnailPath);
      }
    ),
  },
}));

import { DEFAULT_SETTINGS } from '../models/guide';
import { processingPipeline } from '../services/pipeline';

describe('pipeline portrait ONNX failure', () => {
  const prevProcessed = process.env.PROCESSED_DIR;

  afterEach(() => {
    process.env.PROCESSED_DIR = prevProcessed;
  });

  it('falls back to legacy when ONNX line art throws', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pg-pipeline-'));
    process.env.PROCESSED_DIR = tmp;

    const guideId = uuid();
    const imgPath = path.join(tmp, 'in.jpg');
    await sharp({
      create: { width: 32, height: 32, channels: 3, background: '#555555' },
    })
      .jpeg()
      .toFile(imgPath);

    const result = await processingPipeline.process(guideId, imgPath, {
      ...DEFAULT_SETTINGS,
      style: 'portrait_minimal',
    });

    expect(result.guideImagePath).toBe(`/processed/${guideId}_guide.png`);
    expect(result.thumbnailPath).toBe(`/processed/${guideId}_thumb.png`);
    expect(fs.existsSync(path.join(tmp, `${guideId}_guide.png`))).toBe(true);
    expect(fs.existsSync(path.join(tmp, `${guideId}_thumb.png`))).toBe(true);

    const { lineRenderer } = await import('../services/line_renderer');
    expect(lineRenderer.render).toHaveBeenCalled();
  });
});
