import { parentPort, workerData } from 'worker_threads';
import { guideEditService } from '../services/guide_edit_service';
import type { Guide } from '../models/guide';
import type { GuideEditMode } from '../services/guide_edit_service';

export type GuideEditWorkerMessage =
  | { op: 'cleanBackground'; guideId: string }
  | { op: 'replaceGuideImage'; guideId: string; tempFilePath: string }
  | { op: 'ensureVariant'; guide: Guide; mode: GuideEditMode };

async function run(): Promise<void> {
  const msg = workerData as GuideEditWorkerMessage;
  try {
    let result: unknown;
    switch (msg.op) {
      case 'cleanBackground':
        result = await guideEditService.cleanGuideBackground(msg.guideId);
        break;
      case 'replaceGuideImage':
        result = await guideEditService.replaceGuideImageFromFile(msg.guideId, msg.tempFilePath);
        break;
      case 'ensureVariant':
        result = await guideEditService.ensureVariant(msg.guide, msg.mode);
        break;
      default:
        throw new Error('Unknown edit worker operation');
    }
    parentPort?.postMessage({ ok: true as const, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    parentPort?.postMessage({ ok: false as const, error: message });
  }
}

void run();
