export interface Guide {
  id: string;
  createdAt: string;
  updatedAt: string;
  sourceImageUrl: string;
  guideImageUrl: string;
  thumbnailUrl: string;
  /** User-visible label set in Edit Guide. Empty string when not set. */
  name: string;
  layers: GuideLayers;
  settings: GuideSettings;
  favorite: boolean;
  tags: string[];
  status: GuideStatus;
  processingError?: string;
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

export interface CreateGuideRequest {
  tags?: string[];
  settings?: Partial<GuideSettings>;
}

export interface UpdateGuideRequest {
  favorite?: boolean;
  tags?: string[];
  /** Trimmed display name; max 120 characters enforced in route handler. */
  name?: string;
}

export interface GuideListResponse {
  guides: Guide[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ProcessingResult {
  guideImagePath: string;
  thumbnailPath: string;
  detectedLayers: GuideLayers;
  processingTimeMs: number;
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
