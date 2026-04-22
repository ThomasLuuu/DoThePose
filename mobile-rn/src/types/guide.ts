export interface Guide {
  id: string;
  createdAt: string;
  updatedAt: string;
  sourceImageUrl: string;
  guideImageUrl: string;
  thumbnailUrl: string;
  /** User-visible display label. Empty string when not yet named. */
  name: string;
  layers: GuideLayers;
  settings: GuideSettings;
  favorite: boolean;
  tags: string[];
  status: GuideStatus;
  processingError?: string;
  /** Group ids this guide belongs to. Empty means it lives in the virtual "Created" bucket. */
  groupIds: string[];
}

export interface GuideLayers {
  pose: boolean;
  horizon: boolean;
  sun: boolean;
  composition: boolean;
}

export type GuideStyle = 'portrait_minimal' | 'portrait_moderate' | 'portrait_detailed' | 'legacy';

export interface GuideSettings {
  strokeWidth: number;
  opacity: number;
  simplificationLevel: number;
  style?: GuideStyle;
  lineDarkness?: number;
  detailLevel?: number;
  noiseSuppression?: number;
}

export type GuideStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface GuidesListResponse {
  guides: Guide[];
  total: number;
  page: number;
  pageSize: number;
}

export const DEFAULT_SETTINGS: GuideSettings = {
  strokeWidth: 2,
  opacity: 1.0,
  simplificationLevel: 1,
  style: 'portrait_minimal',
  lineDarkness: 1.0,
  detailLevel: 1,
  noiseSuppression: 3,
};
