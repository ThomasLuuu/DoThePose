export interface Group {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  guideCount: number;
}

/** Sentinel id for the virtual "Created" bucket. */
export const CREATED_GROUP_ID = 'unassigned';

export const CREATED_GROUP_NAME = 'Created';

export const MAX_GROUP_NAME_LENGTH = 60;
