import { create } from 'zustand';
import { Group } from '../types/group';
import { apiClient } from '../api/client';

interface GroupsState {
  groups: Group[];
  unassignedCount: number;
  isLoading: boolean;
  error: string | null;

  loadGroups: (opts?: { silent?: boolean }) => Promise<void>;
  createGroup: (name: string) => Promise<Group | null>;
  renameGroup: (id: string, name: string) => Promise<Group | null>;
  deleteGroup: (id: string) => Promise<boolean>;
  addGuidesToGroup: (groupId: string, guideIds: string[]) => Promise<boolean>;
  removeGuidesFromGroup: (groupId: string, guideIds: string[]) => Promise<boolean>;
  setUnassignedCount: (count: number) => void;
  clearError: () => void;
}

export const useGroupsStore = create<GroupsState>((set, get) => ({
  groups: [],
  unassignedCount: 0,
  isLoading: false,
  error: null,

  loadGroups: async ({ silent = false } = {}) => {
    if (get().isLoading) { return; }
    if (!silent) { set({ isLoading: true, error: null }); }
    try {
      const { groups, unassignedCount } = await apiClient.getGroups();
      set({ groups, unassignedCount, isLoading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to load groups', isLoading: false });
    }
  },

  createGroup: async (name: string) => {
    try {
      const created = await apiClient.createGroup(name);
      set((state) => ({ groups: [...state.groups, created] }));
      return created;
    } catch (error: any) {
      set({ error: error.message || 'Failed to create group' });
      return null;
    }
  },

  renameGroup: async (id: string, name: string) => {
    try {
      const updated = await apiClient.renameGroup(id, name);
      set((state) => ({
        groups: state.groups.map((g) => (g.id === id ? updated : g)),
      }));
      return updated;
    } catch (error: any) {
      set({ error: error.message || 'Failed to rename group' });
      return null;
    }
  },

  deleteGroup: async (id: string) => {
    try {
      await apiClient.deleteGroup(id);
      set((state) => ({
        groups: state.groups.filter((g) => g.id !== id),
      }));
      return true;
    } catch (error: any) {
      set({ error: error.message || 'Failed to delete group' });
      return false;
    }
  },

  addGuidesToGroup: async (groupId: string, guideIds: string[]) => {
    try {
      const updated = await apiClient.addGuidesToGroup(groupId, guideIds);
      set((state) => ({
        groups: state.groups.map((g) => (g.id === groupId ? updated : g)),
      }));
      return true;
    } catch (error: any) {
      set({ error: error.message || 'Failed to add to group' });
      return false;
    }
  },

  removeGuidesFromGroup: async (groupId: string, guideIds: string[]) => {
    try {
      const updated = await apiClient.removeGuidesFromGroup(groupId, guideIds);
      set((state) => ({
        groups: state.groups.map((g) => (g.id === groupId ? updated : g)),
      }));
      return true;
    } catch (error: any) {
      set({ error: error.message || 'Failed to remove from group' });
      return false;
    }
  },

  setUnassignedCount: (count: number) => set({ unassignedCount: count }),

  clearError: () => set({ error: null }),
}));
