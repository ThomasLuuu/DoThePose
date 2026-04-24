import { Worker } from 'worker_threads';
import path from 'path';
import { GuideSettings } from '../models/guide';
import { telemetry } from '../utils/telemetry';

interface QueuedJob {
  guideId: string;
  imagePath: string;
  settings: GuideSettings;
  enqueuedAt: number;
  resolve: (result: any) => void;
  reject: (error: Error) => void;
}

const MAX_CONCURRENT = parseInt(process.env.JOB_QUEUE_MAX_CONCURRENT || '2', 10) || 2;
const USE_WORKER_POOL = process.env.WORKER_POOL_ENABLED === 'true';

class JobQueue {
  private queue: QueuedJob[] = [];
  private activeCount = 0;
  // Lazily imported to avoid loading worker_pool when not needed.
  private pool: import('./worker_pool').WorkerPool | null = null;

  constructor() {
    if (USE_WORKER_POOL) {
      // Defer import so non-pool path pays no cost.
      import('./worker_pool').then(({ WorkerPool }) => {
        this.pool = new WorkerPool(MAX_CONCURRENT);
        this.pool.initialize().catch((err) => {
          console.error('[JOB_QUEUE] Worker pool init failed, falling back to per-job workers:', err);
          this.pool = null;
        });
      });
    }
  }

  enqueue(
    guideId: string,
    imagePath: string,
    settings: GuideSettings
  ): Promise<any> {
    const enqueuedAt = Date.now();

    if (this.pool) {
      console.log(`[JOB_QUEUE] Enqueued guide ${guideId} → persistent pool`);
      return this.pool.enqueue(guideId, imagePath, settings, enqueuedAt);
    }

    return new Promise((resolve, reject) => {
      this.queue.push({
        guideId,
        imagePath,
        settings,
        enqueuedAt,
        resolve,
        reject,
      });
      console.log(`[JOB_QUEUE] Enqueued guide ${guideId}, queue depth: ${this.queue.length}, active: ${this.activeCount}`);
      this.processNext();
    });
  }

  private processNext() {
    while (this.activeCount < MAX_CONCURRENT && this.queue.length > 0) {
      const job = this.queue.shift()!;
      this.activeCount++;
      this.runWorker(job);
    }
  }

  private runWorker(job: QueuedJob) {
    const waitMs = Date.now() - job.enqueuedAt;
    telemetry.recordQueueWaitMs(job.guideId, waitMs);

    const workerPath = this.resolveWorkerPath();
    const workerCreatedAt = Date.now();
    console.log(
      `[JOB_QUEUE] Starting worker for guide ${job.guideId}, queueWaitMs: ${waitMs}, path: ${workerPath}`
    );
    const execArgv = this.getExecArgv();
    console.log(`[JOB_QUEUE] Worker execArgv: [${execArgv.join(', ')}]`);

    const worker = new Worker(workerPath, {
      workerData: {
        guideId: job.guideId,
        imagePath: job.imagePath,
        settings: job.settings,
      },
      execArgv,
    });

    const timeout = setTimeout(() => {
      worker.terminate();
      this.activeCount--;
      console.error(
        `[JOB_QUEUE] Timeout for guide ${job.guideId} after 300s` +
        ` (queue depth: ${this.queue.length}, active: ${this.activeCount})`
      );
      job.reject(new Error('Processing timed out after 300s'));
      this.processNext();
    }, 300_000);

    worker.on('message', (msg) => {
      clearTimeout(timeout);
      this.activeCount--;
      const workerRunMs = Date.now() - workerCreatedAt;
      const e2eMs = Date.now() - job.enqueuedAt;
      console.log(
        `[JOB_QUEUE] Guide ${job.guideId} done:` +
        ` guide_e2e_ms=${e2eMs} queue_wait_ms=${waitMs} worker_run_ms=${workerRunMs}`
      );
      if (msg.success) {
        job.resolve(msg.result);
      } else {
        job.reject(new Error(msg.error));
      }
      this.processNext();
    });

    worker.on('error', (err) => {
      clearTimeout(timeout);
      this.activeCount--;
      console.error(`[JOB_QUEUE] Worker error for guide ${job.guideId}:`, err.message);
      job.reject(err);
      this.processNext();
    });

    worker.on('exit', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        this.activeCount = Math.max(0, this.activeCount - 1);
        job.reject(new Error(`Worker exited with code ${code}`));
        this.processNext();
      }
    });
  }

  private isRunningTs(): boolean {
    try {
      const fs = require('fs');
      return __filename.endsWith('.ts') ||
        fs.existsSync(path.resolve(__dirname, '../workers/processing_worker.ts'));
    } catch {
      return false;
    }
  }

  private resolveWorkerPath(): string {
    if (this.isRunningTs()) {
      return path.resolve(__dirname, '../workers/processing_worker.ts');
    }
    return path.resolve(__dirname, '../workers/processing_worker.js');
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

  /** Returns live stats for admin/monitoring endpoints. */
  getStats() {
    if (this.pool) {
      return this.pool.getStats();
    }
    return {
      mode: 'per-job',
      queueDepth: this.queue.length,
      activeWorkers: this.activeCount,
      maxConcurrent: MAX_CONCURRENT,
    };
  }
}

export const jobQueue = new JobQueue();
