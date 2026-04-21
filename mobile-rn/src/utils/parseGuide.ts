import { Guide, GuideLayers, GuideSettings, DEFAULT_SETTINGS } from '../types/guide';

export const parseGuide = (data: any): Guide => {
  return {
    id: String(data.id || ''),
    createdAt: String(data.createdAt || new Date().toISOString()),
    updatedAt: String(data.updatedAt || new Date().toISOString()),
    sourceImageUrl: String(data.sourceImageUrl || ''),
    guideImageUrl: String(data.guideImageUrl || ''),
    thumbnailUrl: String(data.thumbnailUrl || ''),
    layers: parseLayers(data.layers),
    settings: parseSettings(data.settings),
    favorite: Boolean(data.favorite),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    status: parseStatus(data.status),
    processingError: data.processingError ? String(data.processingError) : undefined,
  };
};

const parseLayers = (layers: any): GuideLayers => {
  if (!layers || typeof layers !== 'object') {
    return { pose: false, horizon: false, sun: false, composition: false };
  }
  return {
    pose: Boolean(layers.pose),
    horizon: Boolean(layers.horizon),
    sun: Boolean(layers.sun),
    composition: Boolean(layers.composition),
  };
};

const parseSettings = (settings: any): GuideSettings => {
  if (!settings || typeof settings !== 'object') {
    return DEFAULT_SETTINGS;
  }
  return {
    strokeWidth: Number(settings.strokeWidth) || DEFAULT_SETTINGS.strokeWidth,
    opacity: Number(settings.opacity) || DEFAULT_SETTINGS.opacity,
    simplificationLevel: Number(settings.simplificationLevel) || DEFAULT_SETTINGS.simplificationLevel,
  };
};

const parseStatus = (status: any): Guide['status'] => {
  const validStatuses = ['pending', 'processing', 'completed', 'failed'];
  const statusStr = String(status || 'pending');
  return validStatuses.includes(statusStr) ? statusStr as Guide['status'] : 'pending';
};
