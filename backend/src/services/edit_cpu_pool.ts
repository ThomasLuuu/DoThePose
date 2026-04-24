import { Worker } from 'worker_threads';
import path from 'path';
import type { GuideEditWorkerMessage } from '../workers/guide_edit_worker';

const MAX_CONCURRENT = parseInt(process.env.EDIT_CPU_MAX_CONCURRENT || '2', 10) || 2;
const EDIT_WORKER_TIMEOUT_MS = parseInt(process.env.EDIT_CPU_TIMEOUT_MS || '120000', 10) || 120_000;

interface QueueItem {
  workerData: GuideEditWorkerMessage;
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
}

class EditCpuPool {
  private queue: QueueItem[] = [];
  private activeCount = 0;

  run<T>(workerData: GuideEditWorkerMessage): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ workerData, resolve: resolve as (v: unknown) => void, reject });
      this.processNext();
    });
  }

  private processNext(): void {
    while (this.activeCount < MAX_CONCURRENT && this.queue.length > 0) {
      const item = this.queue.shift()!;
      this.activeCount++;
      this.spawnWorker(item)
        .then(item.resolve, item.reject)
        .finally(() => {
          this.activeCount--;
          this.processNext();
        });
    }
  }

  private isRunningTs(): boolean {
    try {
      const fs = require('fs') as typeof import('fs');
      return __filename.endsWith('.ts') ||
        fs.existsSync(path.resolve(__dirname, '../workers/guide_edit_worker.ts'));
    } catch {
      return false;
    }
  }

  private resolveWorkerPath(): string {
    if (this.isRunningTs()) {
      return path.resolve(__dirname, '../workers/guide_edit_worker.ts');
    }
    return path.resolve(__dirname, '../workers/guide_edit_worker.js');
  }

  private getExecArgv(): string[] {
    if (this.isRunningTs()) {
      try {
        const tsxCjsPath = require.resolve('tsx/cjs');
        return ['--require', tsxCjsPath];
      } catch {
        return ['--require', 'tsx/cjs'];
      }
    }
    return [];
  }

  private spawnWorker(item: QueueItem): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const workerPath = this.resolveWorkerPath();
      const worker = new Worker(workerPath, {
        workerData: item.workerData,
        execArgv: this.getExecArgv(),
      });

      let settled = false;
      const settle = (fn: () => void) => {
        if (settled) {
          return;
        }
        settled = true;
        fn();
      };

      const timeout = setTimeout(() => {
        worker.terminate();
        settle(() => reject(new Error(`Edit worker timed out after ${EDIT_WORKER_TIMEOUT_MS}ms`)));
      }, EDIT_WORKER_TIMEOUT_MS);

      worker.on('message', (msg: { ok: boolean; result?: unknown; error?: string }) => {
        clearTimeout(timeout);
        settle(() => {
          if (msg.ok) {
            resolve(msg.result);
          } else {
            reject(new Error(msg.error || 'Edit worker failed'));
          }
        });
      });

      worker.on('error', (err) => {
        clearTimeout(timeout);
        settle(() => reject(err));
      });

      worker.on('exit', (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          settle(() => reject(new Error(`Edit worker exited with code ${code}`)));
        }
      });
    });
  }
}

export const editCpuPool = new EditCpuPool();

export function runGuideEditCpuTask<T>(workerData: GuideEditWorkerMessage): Promise<T> {
  return editCpuPool.run<T>(workerData);
}
