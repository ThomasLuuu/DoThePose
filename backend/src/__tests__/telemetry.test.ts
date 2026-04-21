import { telemetry } from '../utils/telemetry';

describe('Telemetry', () => {
  beforeEach(() => {
    (telemetry as any).metrics = [];
  });

  describe('startProcessing', () => {
    it('should create a new metric with correct initial values', () => {
      const metric = telemetry.startProcessing('test-guide-1');

      expect(metric.guideId).toBe('test-guide-1');
      expect(metric.startTime).toBeDefined();
      expect(metric.stages).toEqual([]);
      expect(metric.success).toBe(false);
    });
  });

  describe('recordStage', () => {
    it('should add stage to metric', () => {
      const metric = telemetry.startProcessing('test-guide-2');
      const startTime = Date.now();

      telemetry.recordStage(metric, 'background_removal', true, startTime, { test: true });

      expect(metric.stages.length).toBe(1);
      expect(metric.stages[0].name).toBe('background_removal');
      expect(metric.stages[0].success).toBe(true);
      expect(metric.stages[0].metadata).toEqual({ test: true });
    });
  });

  describe('completeProcessing', () => {
    it('should mark metric as complete', () => {
      const metric = telemetry.startProcessing('test-guide-3');

      telemetry.completeProcessing(metric, true);

      expect(metric.endTime).toBeDefined();
      expect(metric.success).toBe(true);
    });

    it('should record error message on failure', () => {
      const metric = telemetry.startProcessing('test-guide-4');

      telemetry.completeProcessing(metric, false, 'Test error');

      expect(metric.success).toBe(false);
      expect(metric.errorMessage).toBe('Test error');
    });
  });

  describe('getAggregatedStats', () => {
    it('should return empty stats when no metrics exist', () => {
      const stats = telemetry.getAggregatedStats();

      expect(stats.totalProcessed).toBe(0);
      expect(stats.successCount).toBe(0);
      expect(stats.failureCount).toBe(0);
    });

    it('should calculate correct stats', () => {
      const metric1 = telemetry.startProcessing('guide-1');
      telemetry.completeProcessing(metric1, true);

      const metric2 = telemetry.startProcessing('guide-2');
      telemetry.completeProcessing(metric2, false, 'Error');

      const stats = telemetry.getAggregatedStats();

      expect(stats.totalProcessed).toBe(2);
      expect(stats.successCount).toBe(1);
      expect(stats.failureCount).toBe(1);
    });
  });

  describe('getRecentErrors', () => {
    it('should return recent errors in reverse order', () => {
      const metric1 = telemetry.startProcessing('guide-1');
      telemetry.completeProcessing(metric1, false, 'Error 1');

      const metric2 = telemetry.startProcessing('guide-2');
      telemetry.completeProcessing(metric2, false, 'Error 2');

      const errors = telemetry.getRecentErrors(5);

      expect(errors.length).toBe(2);
      expect(errors[0].error).toBe('Error 2');
      expect(errors[1].error).toBe('Error 1');
    });
  });
});
