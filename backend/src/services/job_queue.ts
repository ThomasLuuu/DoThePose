import { Worker } from 'worker_threads';
import path from 'path';
import { GuideSettings } from '../models/guide';

interface QueuedJob {
  guideId: string;
  imagePath: string;
  settings: GuideSettings;
  resolve: (result: any) => void;
  reject: (error: Error) => void;
}

const MAX_CONCURRENT = 2;

class JobQueue {
  private queue: QueuedJob[] = [];
  private activeCount = 0;

  enqueue(
    guideId: string,
    imagePath: string,
    settings: GuideSettings
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      this.queue.push({ guideId, imagePath, settings, resolve, reject });
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
    const workerPath = this.resolveWorkerPath();
    const execArgv = this.getExecArgv();
    console.log(`[JOB_QUEUE] Starting worker for guide ${job.guideId}, path: ${workerPath}, execArgv: [${execArgv.join(', ')}]`);

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
      job.reject(new Error('Processing timed out after 300s'));
      this.processNext();
    }, 300_000);

    worker.on('message', (msg) => {
      clearTimeout(timeout);
      this.activeCount--;
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
}

export const jobQueue = new JobQueue();
