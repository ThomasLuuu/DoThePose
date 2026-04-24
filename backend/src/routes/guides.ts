import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { guidesRepository } from '../repositories/guides_repository';
import { groupsRepository } from '../repositories/groups_repository';
import { jobQueue } from '../services/job_queue';
import { Guide, DEFAULT_SETTINGS, CreateGuideRequest, UpdateGuideRequest } from '../models/guide';
import { AppError } from '../middleware/errorHandler';
import { guideEditService, GuideEditMode } from '../services/guide_edit_service';
import { runGuideEditCpuTask } from '../services/edit_cpu_pool';

function withGroupIds<T extends Guide | null>(guide: T): T {
  if (!guide) { return guide; }
  return { ...guide, groupIds: groupsRepository.groupIdsForGuide(guide.id) };
}

function decorateList(guides: Guide[]): Guide[] {
  const map = groupsRepository.groupIdsForGuides(guides.map((g) => g.id));
  return guides.map((g) => ({ ...g, groupIds: map.get(g.id) ?? [] }));
}

const router = Router();

const uploadDir = process.env.UPLOAD_DIR || './uploads';
const maxFileSize = (parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10)) * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.resolve(uploadDir));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: maxFileSize },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
    }
  }
});

router.post('/', upload.single('image'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      throw new AppError('No image file provided', 400);
    }

    if (req.file.size > maxFileSize) {
      throw new AppError(`File too large. Maximum size is ${maxFileSize / 1024 / 1024}MB`, 413);
    }

    const body = req.body;
    
    let parsedSettings: Partial<typeof DEFAULT_SETTINGS> = {};
    if (body.settings) {
      try {
        parsedSettings = typeof body.settings === 'string' 
          ? JSON.parse(body.settings) 
          : body.settings;
      } catch {
        console.warn('[GUIDES] Failed to parse settings:', body.settings);
      }
    }
    
    let parsedTags: string[] = [];
    if (body.tags) {
      try {
        parsedTags = typeof body.tags === 'string' 
          ? JSON.parse(body.tags) 
          : body.tags;
      } catch {
        console.warn('[GUIDES] Failed to parse tags:', body.tags);
      }
    }
    
    const settings = { ...DEFAULT_SETTINGS, ...parsedSettings };
    const tags = parsedTags;

    const id = uuidv4();
    const sourceImageUrl = `/uploads/${req.file.filename}`;

    const guide: Omit<Guide, 'updatedAt'> = {
      id,
      createdAt: new Date().toISOString(),
      sourceImageUrl,
      guideImageUrl: '',
      thumbnailUrl: '',
      name: '',
      layers: { pose: false, horizon: false, sun: false, composition: false },
      settings,
      favorite: false,
      tags,
      status: 'pending'
    };

    const created = guidesRepository.create(guide);

    processGuideAsync(id, req.file.path, settings);

    res.status(201).json({
      status: 'success',
      data: withGroupIds(created)
    });
  } catch (error) {
    next(error);
  }
});

function processGuideAsync(id: string, imagePath: string, settings: typeof DEFAULT_SETTINGS) {
  const jobStart = Date.now();
  console.log(`[GUIDE ${id}] Job enqueued, image: ${imagePath}`);
  guidesRepository.updateStatus(id, 'processing');

  jobQueue
    .enqueue(id, imagePath, settings)
    .then((result) => {
      guidesRepository.update(id, {
        guideImageUrl: result.guideImagePath,
        thumbnailUrl: result.thumbnailPath,
        layers: result.detectedLayers,
        status: 'completed'
      });
      console.log(`[GUIDE ${id}] Job completed in ${Date.now() - jobStart}ms (pipeline: ${result.processingTimeMs}ms)`);
    })
    .catch((error) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown processing error';
      guidesRepository.updateStatus(id, 'failed', errorMessage);
      console.error(`[GUIDE ${id}] Job failed after ${Date.now() - jobStart}ms:`, error);
    });
}

router.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const pageSize = parseInt(req.query.pageSize as string, 10) || 20;

    const { guides, total } = guidesRepository.findAll(page, pageSize);

    res.json({
      status: 'success',
      data: {
        guides: decorateList(guides),
        total,
        page,
        pageSize
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/mode/:mode', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, mode } = req.params;
    if (mode !== 'skeleton' && mode !== 'silhouette') {
      throw new AppError('Invalid mode. Use skeleton or silhouette.', 400);
    }

    const guide = guidesRepository.findById(id);
    if (!guide) {
      throw new AppError('Guide not found', 404);
    }
    if (guide.status !== 'completed') {
      throw new AppError('Guide is not ready', 400);
    }

    const result = await runGuideEditCpuTask<{
      imageUrl: string;
      available: boolean;
      reason?: string;
    }>({ op: 'ensureVariant', guide, mode: mode as GuideEditMode });
    res.json({
      status: 'success',
      data: {
        imageUrl: result.imageUrl,
        available: result.available,
        reason: result.reason,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/clean-background', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const guide = guidesRepository.findById(req.params.id);
    if (!guide) {
      throw new AppError('Guide not found', 404);
    }
    if (guide.status !== 'completed') {
      throw new AppError('Guide is not ready', 400);
    }

    const updated = await runGuideEditCpuTask<Guide | null>({
      op: 'cleanBackground',
      guideId: req.params.id,
    });
    if (!updated) {
      throw new AppError('Could not clean background', 400);
    }

    res.json({
      status: 'success',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/erase', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const guide = guidesRepository.findById(req.params.id);
    if (!guide) {
      throw new AppError('Guide not found', 404);
    }
    if (guide.status !== 'completed') {
      throw new AppError('Guide is not ready', 400);
    }

    const body = req.body as {
      strokes?: Array<Array<{ x: number; y: number }>>;
      brushSize?: number;
    };

    const result = await guideEditService.eraseGuideByStrokes(
      req.params.id,
      Array.isArray(body.strokes) ? body.strokes : [],
      Number(body.brushSize) || 24
    );
    if (!result) {
      throw new AppError('Could not erase guide strokes', 400);
    }

    res.json({
      status: 'success',
      data: result.guide,
      undoCount: result.undoCount,
      redoCount: result.redoCount,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/erase-undo', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await guideEditService.undoErase(req.params.id);
    if (!result) {
      throw new AppError('Could not undo erase', 400);
    }
    res.json({
      status: 'success',
      data: result.guide,
      undoCount: result.undoCount,
      redoCount: result.redoCount,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/erase-redo', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await guideEditService.redoErase(req.params.id);
    if (!result) {
      throw new AppError('Could not redo erase', 400);
    }
    res.json({
      status: 'success',
      data: result.guide,
      undoCount: result.undoCount,
      redoCount: result.redoCount,
    });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/:id/guide-image',
  upload.single('guideImage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new AppError('No image file provided', 400);
      }

      const guide = guidesRepository.findById(req.params.id);
      if (!guide) {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        throw new AppError('Guide not found', 404);
      }
      if (guide.status !== 'completed') {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        throw new AppError('Guide is not ready', 400);
      }

      const updated = await runGuideEditCpuTask<Guide | null>({
        op: 'replaceGuideImage',
        guideId: guide.id,
        tempFilePath: req.file.path,
      });

      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch {
        // ignore
      }

      if (!updated) {
        throw new AppError('Failed to save guide image', 500);
      }

      res.json({
        status: 'success',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const guide = guidesRepository.findById(req.params.id);
    
    if (!guide) {
      throw new AppError('Guide not found', 404);
    }

    res.json({
      status: 'success',
      data: withGroupIds(guide)
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const body: UpdateGuideRequest = req.body;
    const guide = guidesRepository.findById(req.params.id);

    if (!guide) {
      throw new AppError('Guide not found', 404);
    }

    const updates: Partial<Guide> = {};
    if (body.favorite !== undefined) {
      updates.favorite = body.favorite;
    }
    if (body.tags !== undefined) {
      updates.tags = body.tags;
    }
    if (body.name !== undefined) {
      const trimmed = String(body.name).trim();
      updates.name = trimmed.length > 120 ? trimmed.slice(0, 120) : trimmed;
    }

    const updated = guidesRepository.update(req.params.id, updates);

    res.json({
      status: 'success',
      data: withGroupIds(updated)
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const guide = guidesRepository.findById(req.params.id);

    if (!guide) {
      throw new AppError('Guide not found', 404);
    }

    groupsRepository.removeGuideFromAllGroups(req.params.id);
    guidesRepository.delete(req.params.id);

    res.json({
      status: 'success',
      message: 'Guide deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
