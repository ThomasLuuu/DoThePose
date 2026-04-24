import fsPromises from 'fs/promises';
import path from 'path';

const GRADIO_SPACE_URL =
  process.env.GRADIO_INFORMATIVE_DRAWINGS_URL ||
  'https://carolineec-informativedrawings.hf.space/';

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 2000;

const PREDICT_TIMEOUT_MS = parseInt(process.env.GRADIO_PREDICT_TIMEOUT_MS || '120000', 10) || 120_000;
const FETCH_URL_TIMEOUT_MS = parseInt(process.env.GRADIO_FETCH_URL_TIMEOUT_MS || '60000', 10) || 60_000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

const STYLE_MAP: Record<string, string> = {
  portrait_minimal: 'style 1',
  portrait_moderate: 'style 2',
  portrait_detailed: 'style 2', // Space only has 2 styles; detailed falls back to style 2
};

function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  };
  return map[ext.toLowerCase()] || 'image/png';
}

async function blobToBuffer(blob: Blob): Promise<Buffer> {
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function fetchUrlToBuffer(url: string): Promise<Buffer> {
  const res = await fetchWithTimeout(url, {}, FETCH_URL_TIMEOUT_MS);
  if (!res.ok) {
    throw new Error(`Failed to fetch image from ${url}: ${res.status}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callGradioViaHttp(
  imageBuffer: Buffer,
  mimeType: string,
  version: string,
  startTime: number
): Promise<Buffer> {
  const base64Image = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
  
  let lastError: unknown;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[GRADIO] HTTP Attempt ${attempt}/${MAX_RETRIES}: Calling ${GRADIO_SPACE_URL}api/predict`);
      
      const response = await fetchWithTimeout(
        `${GRADIO_SPACE_URL}api/predict`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            data: [base64Image, version],
            fn_index: 0,
            session_hash: `node_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          }),
        },
        PREDICT_TIMEOUT_MS
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      
      const result = await response.json() as { data?: unknown[]; error?: string };
      console.log(`[GRADIO] HTTP prediction completed in ${Date.now() - startTime}ms`);
      
      if (result.error) {
        throw new Error(`Gradio error: ${result.error}`);
      }
      
      const data = result.data;
      if (!data || data.length === 0) {
        throw new Error('[GRADIO] Empty prediction result');
      }

      const payload = data[0];
      let buffer: Buffer;

      if (typeof payload === 'string' && payload.startsWith('data:')) {
        console.log(`[GRADIO] Payload is base64 data URL`);
        const base64Data = payload.split(',')[1];
        buffer = Buffer.from(base64Data, 'base64');
      } else if (typeof payload === 'string' && payload.startsWith('http')) {
        console.log(`[GRADIO] Payload is URL: ${payload}`);
        buffer = await fetchUrlToBuffer(payload);
      } else if (payload && typeof payload === 'object' && 'url' in payload && typeof (payload as { url: string }).url === 'string') {
        console.log(`[GRADIO] Payload is object with URL`);
        buffer = await fetchUrlToBuffer((payload as { url: string }).url);
      } else {
        console.error('[GRADIO] Unknown payload type:', typeof payload);
        throw new Error('[GRADIO] Cannot extract image from prediction result');
      }

      console.log(`[GRADIO] Total fetch time: ${Date.now() - startTime}ms, buffer size: ${buffer.length}`);
      return buffer;
      
    } catch (error) {
      lastError = error;
      
      if (attempt < MAX_RETRIES) {
        const delayMs = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`[GRADIO] HTTP Attempt ${attempt} failed, retrying in ${delayMs}ms...`);
        if (error instanceof Error) {
          console.log(`[GRADIO] Error: ${error.message}`);
        }
        await sleep(delayMs);
      }
    }
  }
  
  throw lastError;
}

export async function fetchLineArt(
  imagePath: string,
  style?: string
): Promise<Buffer> {
  const startTime = Date.now();
  const version = STYLE_MAP[style || ''] || 'style 1';

  console.log(`[GRADIO] Fetching line art for ${imagePath} with version="${version}"`);

  try {
    const imageBuffer = await fsPromises.readFile(imagePath);
    const ext = path.extname(imagePath);
    const mimeType = getMimeType(ext);

    console.log(`[GRADIO] Image loaded: ${imageBuffer.length} bytes, type: ${mimeType}`);

    return await callGradioViaHttp(imageBuffer, mimeType, version, startTime);
    
  } catch (error) {
    let errorMessage: string;
    if (error instanceof Error) {
      errorMessage = error.message;
      console.error(`[GRADIO] Error: ${errorMessage}`);
      if (error.stack) {
        console.error(`[GRADIO] Stack: ${error.stack}`);
      }
    } else if (error && typeof error === 'object') {
      try {
        errorMessage = JSON.stringify(error, Object.getOwnPropertyNames(error));
      } catch {
        errorMessage = String(error);
      }
      console.error(`[GRADIO] Error object:`, error);
    } else {
      errorMessage = String(error);
      console.error(`[GRADIO] Error: ${errorMessage}`);
    }
    throw new Error(`[GRADIO] Failed to fetch line art: ${errorMessage}`);
  }
}
