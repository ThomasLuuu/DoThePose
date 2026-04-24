interface ProcessingMetrics {
  guideId: string;
  startTime: number;
  endTime?: number;
  stages: StageMetric[];
  success: boolean;
  errorMessage?: string;
}

interface StageMetric {
  name: string;
  startTime: number;
  endTime: number;
  success: boolean;
  metadata?: Record<string, unknown>;
}

interface AggregatedStats {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  avgProcessingTimeMs: number;
  p95ProcessingTimeMs: number;
  stageStats: Record<
    string,
    { avgTimeMs: number; p95TimeMs: number; successRate: number }
  >;
  queueWait?: {
    sampleCount: number;
    avgWaitMs: number;
    p95WaitMs: number;
  };
}

import type { DurationSample, LatencyBucket } from './http_telemetry';
import { aggregateDurationsMs } from './http_telemetry';

class Telemetry {
  private metrics: ProcessingMetrics[] = [];
  private maxMetrics = 1000;
  private httpSamples: DurationSample[] = [];
  private maxHttpSamples = 2000;
  private queueWaitSamples: DurationSample[] = [];
  private maxQueueWaitSamples = 1000;

  startProcessing(guideId: string): ProcessingMetrics {
    const metric: ProcessingMetrics = {
      guideId,
      startTime: Date.now(),
      stages: [],
      success: false,
    };
    
    this.metrics.push(metric);
    
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
    
    return metric;
  }

  recordStage(
    metric: ProcessingMetrics,
    stageName: string,
    success: boolean,
    startTime: number,
    metadata?: Record<string, unknown>
  ): void {
    metric.stages.push({
      name: stageName,
      startTime,
      endTime: Date.now(),
      success,
      metadata,
    });
  }

  recordHttpLatency(routeKey: string, durationMs: number): void {
    this.httpSamples.push({
      key: routeKey,
      durationMs,
      ts: Date.now(),
    });
    if (this.httpSamples.length > this.maxHttpSamples) {
      this.httpSamples = this.httpSamples.slice(-this.maxHttpSamples);
    }
  }

  recordQueueWaitMs(guideId: string, waitMs: number): void {
    this.queueWaitSamples.push({
      key: guideId,
      durationMs: waitMs,
      ts: Date.now(),
    });
    if (this.queueWaitSamples.length > this.maxQueueWaitSamples) {
      this.queueWaitSamples = this.queueWaitSamples.slice(-this.maxQueueWaitSamples);
    }
  }

  getHttpLatencyStats(sinceMs?: number): Record<string, LatencyBucket> {
    return aggregateDurationsMs(this.httpSamples, sinceMs);
  }

  getQueueWaitStats(sinceMs?: number): { sampleCount: number; avgWaitMs: number; p95WaitMs: number } {
    const relevant = sinceMs
      ? this.queueWaitSamples.filter((s) => s.ts >= Date.now() - sinceMs)
      : this.queueWaitSamples;
    if (relevant.length === 0) {
      return { sampleCount: 0, avgWaitMs: 0, p95WaitMs: 0 };
    }
    const waits = relevant.map((s) => s.durationMs).sort((a, b) => a - b);
    const sum = waits.reduce((a, b) => a + b, 0);
    const p95Idx = Math.min(waits.length - 1, Math.floor(waits.length * 0.95));
    return {
      sampleCount: waits.length,
      avgWaitMs: sum / waits.length,
      p95WaitMs: waits[p95Idx] ?? 0,
    };
  }

  completeProcessing(metric: ProcessingMetrics, success: boolean, errorMessage?: string): void {
    metric.endTime = Date.now();
    metric.success = success;
    metric.errorMessage = errorMessage;
    
    const duration = metric.endTime - metric.startTime;
    console.log(`[TELEMETRY] Guide ${metric.guideId} processed in ${duration}ms, success: ${success}`);
    
    for (const stage of metric.stages) {
      const stageDuration = stage.endTime - stage.startTime;
      console.log(`  - ${stage.name}: ${stageDuration}ms, success: ${stage.success}`);
    }
  }

  getAggregatedStats(sinceMs?: number): AggregatedStats {
    const cutoff = sinceMs ? Date.now() - sinceMs : 0;
    const relevantMetrics = this.metrics.filter(
      m => m.startTime >= cutoff && m.endTime !== undefined
    );

    if (relevantMetrics.length === 0) {
      return {
        totalProcessed: 0,
        successCount: 0,
        failureCount: 0,
        avgProcessingTimeMs: 0,
        p95ProcessingTimeMs: 0,
        stageStats: {},
        queueWait: this.getQueueWaitStats(sinceMs),
      };
    }

    const successMetrics = relevantMetrics.filter(m => m.success);
    const failureMetrics = relevantMetrics.filter(m => !m.success);

    const processingTimes = relevantMetrics
      .map(m => (m.endTime || 0) - m.startTime)
      .sort((a, b) => a - b);

    const avgProcessingTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
    const p95Index = Math.floor(processingTimes.length * 0.95);
    const p95ProcessingTime = processingTimes[p95Index] || processingTimes[processingTimes.length - 1];

    const stageStats: Record<
      string,
      { avgTimeMs: number; p95TimeMs: number; successRate: number }
    > = {};
    const stageData: Record<string, { times: number[]; successes: number; total: number }> = {};

    for (const metric of relevantMetrics) {
      for (const stage of metric.stages) {
        if (!stageData[stage.name]) {
          stageData[stage.name] = { times: [], successes: 0, total: 0 };
        }
        stageData[stage.name].times.push(stage.endTime - stage.startTime);
        stageData[stage.name].total++;
        if (stage.success) {
          stageData[stage.name].successes++;
        }
      }
    }

    for (const [name, data] of Object.entries(stageData)) {
      const sorted = [...data.times].sort((a, b) => a - b);
      const p95Idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
      stageStats[name] = {
        avgTimeMs: sorted.reduce((a, b) => a + b, 0) / sorted.length,
        p95TimeMs: sorted[p95Idx] ?? 0,
        successRate: data.successes / data.total,
      };
    }

    return {
      totalProcessed: relevantMetrics.length,
      successCount: successMetrics.length,
      failureCount: failureMetrics.length,
      avgProcessingTimeMs: avgProcessingTime,
      p95ProcessingTimeMs: p95ProcessingTime,
      stageStats,
      queueWait: this.getQueueWaitStats(sinceMs),
    };
  }

  getRecentErrors(limit: number = 10): Array<{ guideId: string; error: string; timestamp: number }> {
    return this.metrics
      .filter(m => !m.success && m.errorMessage)
      .slice(-limit)
      .map(m => ({
        guideId: m.guideId,
        error: m.errorMessage || 'Unknown error',
        timestamp: m.endTime || m.startTime,
      }))
      .reverse();
  }
}

export const telemetry = new Telemetry();
