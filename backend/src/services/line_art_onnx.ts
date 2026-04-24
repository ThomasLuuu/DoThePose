import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import * as ort from 'onnxruntime-node';

let sessionPromise: Promise<ort.InferenceSession> | null = null;

function resolveModelPath(): string {
  const env = process.env.LINE_ART_ONNX_PATH?.trim();
  if (env) {
    return path.resolve(env);
  }
  return path.resolve(process.cwd(), 'models', 'model.onnx');
}

export async function getSession(): Promise<ort.InferenceSession> {
  if (!sessionPromise) {
    const modelPath = resolveModelPath();
    if (!fs.existsSync(modelPath)) {
      throw new Error(
        `[ONNX_LINE_ART] Model not found at ${modelPath}. Set LINE_ART_ONNX_PATH or place model.onnx in models/`
      );
    }
    sessionPromise = ort.InferenceSession.create(modelPath);
  }
  return sessionPromise;
}

/** Clears cached session (e.g. between tests or after env change). */
export function resetLineArtOnnxSessionForTests(): void {
  sessionPromise = null;
}

/**
 * Converts informative-drawings ONNX greyscale output (NCHW float32 ~0..1) to an RGBA PNG buffer.
 * Matches the browser demo: grey replicated to RGB, opaque alpha — downstream `normalizeLineArt` handles transparency.
 */
export async function convertOnnxGreyOutputToPng(
  dims: readonly number[],
  data: Float32Array
): Promise<Buffer> {
  if (dims.length < 4) {
    throw new Error(`[ONNX_LINE_ART] Expected output rank >= 4, got dims=${JSON.stringify(dims)}`);
  }
  const height = dims[2]!;
  const width = dims[3]!;
  const c = dims[1]!;
  const count = width * height;
  if (data.length < c * count) {
    throw new Error(
      `[ONNX_LINE_ART] Output data length ${data.length} too small for dims ${JSON.stringify(dims)}`
    );
  }

  const grey = new Float32Array(count);
  if (c === 1) {
    grey.set(data.subarray(0, count));
  } else if (c === 3) {
    for (let i = 0; i < count; i++) {
      const r = data[i]!;
      const g = data[count + i]!;
      const b = data[2 * count + i]!;
      grey[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    }
  } else {
    throw new Error(`[ONNX_LINE_ART] Unsupported output channels: ${c}`);
  }

  const rgba = Buffer.alloc(count * 4);
  for (let i = 0; i < count; i++) {
    const v = Math.min(255, Math.max(0, Math.round(grey[i]! * 255)));
    const o = i * 4;
    rgba[o] = v;
    rgba[o + 1] = v;
    rgba[o + 2] = v;
    rgba[o + 3] = 255;
  }

  return sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

async function imagePathToNchwFloat32(
  session: ort.InferenceSession,
  imagePath: string
): Promise<{ tensor: ort.Tensor; inputName: string }> {
  const { data, info } = await sharp(imagePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const channels = info.channels;
  if (width <= 0 || height <= 0) {
    throw new Error(`[ONNX_LINE_ART] Invalid image dimensions ${width}x${height}`);
  }

  const count = width * height;
  const plane = count;
  const tensorData = new Float32Array(3 * plane);
  const src = data;
  const stride = channels;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * stride;
      const r = src[si]! / 255;
      const g = src[si + 1]! / 255;
      const b = src[si + 2]! / 255;
      const di = y * width + x;
      tensorData[di] = r;
      tensorData[plane + di] = g;
      tensorData[2 * plane + di] = b;
    }
  }

  const inputName =
    session.inputNames.length === 1
      ? session.inputNames[0]!
      : session.inputNames.includes('input')
        ? 'input'
        : session.inputNames[0]!;

  const tensor = new ort.Tensor('float32', tensorData, [1, 3, height, width]);
  return { tensor, inputName };
}

export interface LineArtResult {
  buffer: Buffer;
  preMs: number;
  inferenceMs: number;
  postMs: number;
}

/**
 * Runs local ONNX line-art model (informative-drawings style).
 * `style` is accepted for API compatibility with the old Gradio path; this model has a single style.
 * Returns the PNG buffer along with sub-stage timing breakdowns.
 */
export async function fetchLineArt(imagePath: string, _style?: string): Promise<LineArtResult> {
  const totalStart = Date.now();
  const session = await getSession();

  const preStart = Date.now();
  const { tensor, inputName } = await imagePathToNchwFloat32(session, imagePath);
  const preMs = Date.now() - preStart;

  const inferenceStart = Date.now();
  const feeds: Record<string, ort.Tensor> = { [inputName]: tensor };
  const results = await session.run(feeds);
  const inferenceMs = Date.now() - inferenceStart;

  const outName =
    session.outputNames.length === 1
      ? session.outputNames[0]!
      : session.outputNames.includes('output')
        ? 'output'
        : session.outputNames[0]!;

  const out = results[outName];
  if (!out || !out.data || !out.dims) {
    throw new Error(`[ONNX_LINE_ART] Missing output tensor (name=${outName})`);
  }

  if (!(out.data instanceof Float32Array)) {
    throw new Error(`[ONNX_LINE_ART] Expected float32 output, got ${typeof out.data}`);
  }

  const postStart = Date.now();
  const png = await convertOnnxGreyOutputToPng(out.dims, out.data);
  const postMs = Date.now() - postStart;

  console.log(
    `[ONNX_LINE_ART] pre:${preMs}ms inference:${inferenceMs}ms post:${postMs}ms total:${Date.now() - totalStart}ms path:${imagePath}`
  );
  return { buffer: png, preMs, inferenceMs, postMs };
}
