import { Worker } from 'worker_threads';
import path from 'path';
import { telemetry } from '../utils/telemetry';
import { GuideSettings } from '../models/guide';

interface PoolJob {
  jobId: number;
  guideId: string;
  imagePath: string;
  settings: GuideSettings;
  enqueuedAt: number;
  resolve: (result: any) => void;
  reject: (error: Error) => void;
}

interface PoolWorker {
  worker: Worker;
  busy: boolean;
  spawnedAt: number;
}

export class WorkerPool {
  private workers: PoolWorker[] = [];
  private pending: PoolJob[] = [];
  private callbacks = new Map<number, PoolJob>();
  private jobCounter = 0;
  private size: number;
  private initialized = false;

  constructor(size: number) {
    this.size = size;
  }

  async initialize(): Promise<void> {
    if (this.initialized) { return; }
    this.initialized = true;

    const workerPath = this.resolveWorkerPath();
    const execArgv = this.getExecArgv();

    console.log(`[WORKER_POOL] Spawning ${this.size} persistent workers`);
    await Promise.all(
      Array.from({ length: this.size }, () => this.spawnWorker(workerPath, execArgv))
    );
    console.log(`[WORKER_POOL] All ${this.workers.length} workers ready`);
  }

  private spawnWorker(workerPath: string, execArgv: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const pw: PoolWorker = {
        worker: new Worker(workerPath, { execArgv }),
        busy: false,
        spawnedAt: Date.now(),
      };

      const onReady = (msg: any) => {
        if (msg?.type !== 'ready') { return; }
        pw.worker.off('message', onReady);
        const warmMs = Date.now() - pw.spawnedAt;
        console.log(`[WORKER_POOL] Worker ready in ${warmMs}ms`);
        this.workers.push(pw);
        pw.worker.on('message', (m) => this.onWorkerMessage(pw, m));
        resolve();
      };

      pw.worker.on('message', onReady);

      pw.worker.on('error', (err) => {
        console.error('[WORKER_POOL] Worker error:', err.message);
        this.handleWorkerDeath(pw, err, workerPath, execArgv);
        // If this worker hadn't signalled ready yet, reject the spawn promise.
        reject(err);
      });

      pw.worker.on('exit', (code) => {
        if (code !== 0) {
          const err = new Error(`Worker exited with code ${code}`);
          this.handleWorkerDeath(pw, err, workerPath, execArgv);
        }
      });
    });
  }

  private onWorkerMessage(pw: PoolWorker, msg: any) {
    if (msg?.type !== 'done') { return; }

    pw.busy = false;
    const job = this.callbacks.get(msg.jobId);
    if (job) {
      this.callbacks.delete(msg.jobId);
      const e2eMs = Date.now() - job.enqueuedAt;
      console.log(`[WORKER_POOL] Guide ${job.guideId} done: guide_e2e_ms=${e2eMs}`);
      if (msg.success) {
        job.resolve(msg.result);
      } else {
        job.reject(new Error(msg.error));
      }
    }
    this.drain();
  }

  private handleWorkerDeath(pw: PoolWorker, err: Error, workerPath: string, execArgv: string[]) {
    this.workers = this.workers.filter((w) => w !== pw);

    // Fail any job that was in flight on this worker.
    for (const [jobId, job] of this.callbacks) {
      this.callbacks.delete(jobId);
      job.reject(new Error(`Worker died: ${err.message}`));
    }

    // Respawn replacement.
    console.log('[WORKER_POOL] Respawning worker after crash');
    this.spawnWorker(workerPath, execArgv).catch((e) =>
      console.error('[WORKER_POOL] Respawn failed:', e)
    );
  }

  enqueue(
    guideId: string,
    imagePath: string,
    settings: GuideSettings,
    enqueuedAt: number
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const jobId = ++this.jobCounter;
      const job: PoolJob = { jobId, guideId, imagePath, settings, enqueuedAt, resolve, reject };
      this.pending.push(job);
      console.log(`[WORKER_POOL] Enqueued guide ${guideId}, pending: ${this.pending.length}`);
      this.drain();
    });
  }

  private drain() {
    while (this.pending.length > 0) {
      const idle = this.workers.find((w) => !w.busy);
      if (!idle) { break; }

      const job = this.pending.shift()!;
      idle.busy = true;
      this.callbacks.set(job.jobId, job);

      const waitMs = Date.now() - job.enqueuedAt;
      telemetry.recordQueueWaitMs(job.guideId, waitMs);
      console.log(`[WORKER_POOL] Dispatching guide ${job.guideId} (queue_wait_ms=${waitMs})`);

      idle.worker.postMessage({
        type: 'job',
        jobId: job.jobId,
        guideId: job.guideId,
        imagePath: job.imagePath,
        settings: job.settings,
      });
    }
  }

  getStats() {
    return {
      mode: 'persistent-pool',
      poolSize: this.workers.length,
      busyWorkers: this.workers.filter((w) => w.busy).length,
      idleWorkers: this.workers.filter((w) => !w.busy).length,
      queueDepth: this.pending.length,
      maxConcurrent: this.size,
    };
  }

  private isRunningTs(): boolean {
    try {
      const fs = require('fs');
      return __filename.endsWith('.ts') ||
        fs.existsSync(path.resolve(__dirname, '../workers/persistent_worker.ts'));
    } catch {
      return false;
    }
  }

  private resolveWorkerPath(): string {
    if (this.isRunningTs()) {
      return path.resolve(__dirname, '../workers/persistent_worker.ts');
    }
    return path.resolve(__dirname, '../workers/persistent_worker.js');
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
}
