import { Router, Request, Response, NextFunction } from 'express';
import { telemetry } from '../utils/telemetry';
import { cleanupService } from '../services/cleanup';
import { guidesRepository } from '../repositories/guides_repository';

const router = Router();

router.get('/stats', (req: Request, res: Response, next: NextFunction) => {
  try {
    const sinceHours = parseInt(req.query.sinceHours as string, 10) || 24;
    const sinceMs = sinceHours * 60 * 60 * 1000;

    const processingStats = telemetry.getAggregatedStats(sinceMs);
    const httpLatency = telemetry.getHttpLatencyStats(sinceMs);
    const storageStats = cleanupService.getStorageStats();
    const { total: totalGuides } = guidesRepository.findAll(1, 1);

    res.json({
      status: 'success',
      data: {
        processing: processingStats,
        httpLatency,
        storage: storageStats,
        guides: {
          total: totalGuides,
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/errors', (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const errors = telemetry.getRecentErrors(limit);

    res.json({
      status: 'success',
      data: errors,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/cleanup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const maxAgeHours = parseInt(req.body.maxAgeHours as string, 10) || 24;
    
    const [failedStats, orphanStats] = await Promise.all([
      cleanupService.cleanupFailedGuides(maxAgeHours),
      cleanupService.cleanupOrphanedFiles(),
    ]);

    res.json({
      status: 'success',
      data: {
        failed: failedStats,
        orphaned: orphanStats,
        total: {
          deletedGuides: failedStats.deletedGuides,
          deletedFiles: failedStats.deletedFiles + orphanStats.deletedFiles,
          freedSpaceMB: failedStats.freedSpaceMB + orphanStats.freedSpaceMB,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/storage', (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = cleanupService.getStorageStats();

    res.json({
      status: 'success',
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
