import { parentPort, workerData } from 'worker_threads';
import { processingPipeline } from '../services/pipeline';

interface WorkerInput {
  guideId: string;
  imagePath: string;
  settings: any;
}

async function run() {
  const { guideId, imagePath, settings } = workerData as WorkerInput;
  try {
    const result = await processingPipeline.process(guideId, imagePath, settings);
    parentPort?.postMessage({ success: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    parentPort?.postMessage({ success: false, error: message });
  }
}

run();
