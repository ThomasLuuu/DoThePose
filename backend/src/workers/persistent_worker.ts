import { parentPort } from 'worker_threads';
import { processingPipeline } from '../services/pipeline';
import { getSession } from '../services/line_art_onnx';

interface JobMessage {
  type: 'job';
  jobId: number;
  guideId: string;
  imagePath: string;
  settings: any;
}

async function warmup(): Promise<void> {
  try {
    await getSession();
    console.log('[PERSISTENT_WORKER] ONNX session warmed up');
  } catch {
    // Model may be absent in some environments; first real job will fail gracefully.
    console.warn('[PERSISTENT_WORKER] ONNX warmup skipped (model not found)');
  }
}

warmup().then(() => {
  parentPort?.postMessage({ type: 'ready' });
});

parentPort?.on('message', async (msg: JobMessage) => {
  if (msg.type !== 'job') { return; }

  const { jobId, guideId, imagePath, settings } = msg;
  try {
    const result = await processingPipeline.process(guideId, imagePath, settings);
    parentPort?.postMessage({ type: 'done', jobId, success: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    parentPort?.postMessage({ type: 'done', jobId, success: false, error: message });
  }
});
