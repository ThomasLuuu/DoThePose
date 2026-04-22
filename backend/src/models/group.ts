export interface Group {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  guideCount: number;
}

export interface CreateGroupRequest {
  name: string;
}

export interface UpdateGroupRequest {
  name?: string;
}

export interface GroupMembershipRequest {
  guideIds: string[];
}

export const MAX_GROUP_NAME_LENGTH = 60;
