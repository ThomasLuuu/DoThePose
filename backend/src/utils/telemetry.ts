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
  stageStats: Record<string, { avgTimeMs: number; successRate: number }>;
}

class Telemetry {
  private metrics: ProcessingMetrics[] = [];
  private maxMetrics = 1000;

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

    const stageStats: Record<string, { avgTimeMs: number; successRate: number }> = {};
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
      stageStats[name] = {
        avgTimeMs: data.times.reduce((a, b) => a + b, 0) / data.times.length,
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
