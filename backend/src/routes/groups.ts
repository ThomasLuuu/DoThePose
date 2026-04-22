import { Router, Request, Response, NextFunction } from 'express';
import { groupsRepository } from '../repositories/groups_repository';
import { guidesRepository } from '../repositories/guides_repository';
import { AppError } from '../middleware/errorHandler';
import { CreateGroupRequest, UpdateGroupRequest, GroupMembershipRequest, MAX_GROUP_NAME_LENGTH } from '../models/group';

const router = Router();

function cleanName(raw: unknown): string {
  if (typeof raw !== 'string') { return ''; }
  const trimmed = raw.trim();
  return trimmed.length > MAX_GROUP_NAME_LENGTH ? trimmed.slice(0, MAX_GROUP_NAME_LENGTH) : trimmed;
}

function parseGuideIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) { return []; }
  return raw.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
}

router.get('/', (_req: Request, res: Response, next: NextFunction) => {
  try {
    const groups = groupsRepository.findAll();
    const unassignedCount = groupsRepository.unassignedCount();
    res.json({
      status: 'success',
      data: { groups, unassignedCount },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as CreateGroupRequest;
    const name = cleanName(body?.name);
    if (!name) {
      throw new AppError('Group name is required', 400);
    }
    const group = groupsRepository.create(name);
    res.status(201).json({ status: 'success', data: group });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as UpdateGroupRequest;
    const name = cleanName(body?.name);
    if (!name) {
      throw new AppError('Group name is required', 400);
    }
    const updated = groupsRepository.rename(req.params.id, name);
    if (!updated) {
      throw new AppError('Group not found', 404);
    }
    res.json({ status: 'success', data: updated });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = groupsRepository.delete(req.params.id);
    if (!deleted) {
      throw new AppError('Group not found', 404);
    }
    res.json({ status: 'success', message: 'Group deleted successfully' });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/guides', (req: Request, res: Response, next: NextFunction) => {
  try {
    const group = groupsRepository.findById(req.params.id);
    if (!group) {
      throw new AppError('Group not found', 404);
    }
    const body = req.body as GroupMembershipRequest;
    const ids = parseGuideIds(body?.guideIds);
    groupsRepository.addGuides(req.params.id, ids);
    const refreshed = groupsRepository.findById(req.params.id);
    res.json({ status: 'success', data: refreshed });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id/guides', (req: Request, res: Response, next: NextFunction) => {
  try {
    const group = groupsRepository.findById(req.params.id);
    if (!group) {
      throw new AppError('Group not found', 404);
    }
    const body = req.body as GroupMembershipRequest;
    const ids = parseGuideIds(body?.guideIds);
    groupsRepository.removeGuides(req.params.id, ids);
    const refreshed = groupsRepository.findById(req.params.id);
    res.json({ status: 'success', data: refreshed });
  } catch (error) {
    next(error);
  }
});

/** List guides in a group, or `unassigned` for the virtual "Created" bucket. */
router.get('/:id/guides', (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const pageSize = parseInt(req.query.pageSize as string, 10) || 20;
    const groupId = req.params.id;

    let guideIds: string[];
    let total: number;

    if (groupId === 'unassigned') {
      ({ guideIds, total } = groupsRepository.unassignedGuideIds(page, pageSize));
    } else {
      const group = groupsRepository.findById(groupId);
      if (!group) {
        throw new AppError('Group not found', 404);
      }
      ({ guideIds, total } = groupsRepository.guideIdsInGroup(groupId, page, pageSize));
    }

    const membershipMap = groupsRepository.groupIdsForGuides(guideIds);
    const guides = guideIds
      .map((id) => guidesRepository.findById(id))
      .filter((g): g is NonNullable<typeof g> => g !== null)
      .map((g) => ({ ...g, groupIds: membershipMap.get(g.id) ?? [] }));

    res.json({
      status: 'success',
      data: { guides, total, page, pageSize },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
