import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import {
  convertOnnxGreyOutputToPng,
  fetchLineArt,
  resetLineArtOnnxSessionForTests,
} from '../services/line_art_onnx';

describe('line_art_onnx', () => {
  afterEach(() => {
    delete process.env.LINE_ART_ONNX_PATH;
    resetLineArtOnnxSessionForTests();
  });

  describe('convertOnnxGreyOutputToPng', () => {
    it('encodes single-channel NCHW float grey as PNG', async () => {
      const dims = [1, 1, 1, 1] as const;
      const data = new Float32Array([0.5]);
      const png = await convertOnnxGreyOutputToPng(dims, data);
      const meta = await sharp(png).metadata();
      expect(meta.width).toBe(1);
      expect(meta.height).toBe(1);
    });

    it('derives grey from 3-channel NCHW via luminance', async () => {
      const h = 2;
      const w = 2;
      const count = h * w;
      const data = new Float32Array(3 * count);
      data.fill(1);
      const png = await convertOnnxGreyOutputToPng([1, 3, h, w], data);
      const { data: raw, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      expect(info.width).toBe(w);
      expect(info.height).toBe(h);
      expect(raw[0]).toBeGreaterThan(250);
    });

    it('throws on unsupported channel count', async () => {
      const data = new Float32Array(8);
      await expect(convertOnnxGreyOutputToPng([1, 2, 2, 2], data)).rejects.toThrow(/Unsupported output channels/);
    });
  });

  describe('fetchLineArt', () => {
    it('rejects when model file is missing', async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'line-art-onnx-'));
      const imgPath = path.join(tmp, 'in.png');
      await sharp({
        create: { width: 8, height: 8, channels: 3, background: '#336699' },
      })
        .png()
        .toFile(imgPath);

      process.env.LINE_ART_ONNX_PATH = path.join(tmp, 'missing-model.onnx');
      resetLineArtOnnxSessionForTests();

      await expect(fetchLineArt(imgPath)).rejects.toThrow(/Model not found/);
    });
  });
});
