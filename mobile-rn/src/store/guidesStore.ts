import { create } from 'zustand';
import { Guide } from '../types/guide';
import { apiClient } from '../api/client';

interface GuidesState {
  guides: Guide[];
  isLoading: boolean;
  error: string | null;
  currentPage: number;
  hasMore: boolean;
  
  loadGuides: (refresh?: boolean) => Promise<void>;
  refreshGuide: (id: string) => Promise<Guide | null>;
  toggleFavorite: (id: string) => Promise<void>;
  deleteGuide: (id: string) => Promise<boolean>;
  addGuide: (guide: Guide) => void;
  updateGuideInList: (guide: Guide) => void;
  clearError: () => void;
}

export const useGuidesStore = create<GuidesState>((set, get) => ({
  guides: [],
  isLoading: false,
  error: null,
  currentPage: 1,
  hasMore: true,

  loadGuides: async (refresh = false) => {
    const state = get();
    if (state.isLoading) return;
    if (!refresh && !state.hasMore) return;

    set({ isLoading: true, error: null });

    try {
      const page = refresh ? 1 : state.currentPage;
      const response = await apiClient.getGuides(page);

      set({
        guides: refresh ? response.guides : [...state.guides, ...response.guides],
        currentPage: page + 1,
        hasMore: page * response.pageSize < response.total,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.message || 'Failed to load guides',
        isLoading: false,
      });
    }
  },

  refreshGuide: async (id: string) => {
    try {
      const updated = await apiClient.getGuide(id);
      const state = get();
      set({
        guides: state.guides.map((g) => (g.id === id ? updated : g)),
      });
      return updated;
    } catch (error) {
      return null;
    }
  },

  toggleFavorite: async (id: string) => {
    const state = get();
    const guide = state.guides.find((g) => g.id === id);
    if (!guide) return;

    try {
      const updated = await apiClient.updateGuide(id, { favorite: !guide.favorite });
      set({
        guides: state.guides.map((g) => (g.id === id ? updated : g)),
      });
    } catch (error: any) {
      set({ error: error.message || 'Failed to update guide' });
    }
  },

  deleteGuide: async (id: string) => {
    try {
      await apiClient.deleteGuide(id);
      const state = get();
      set({
        guides: state.guides.filter((g) => g.id !== id),
      });
      return true;
    } catch (error: any) {
      set({ error: error.message || 'Failed to delete guide' });
      return false;
    }
  },

  addGuide: (guide: Guide) => {
    const state = get();
    set({ guides: [guide, ...state.guides] });
  },

  updateGuideInList: (guide: Guide) => {
    const state = get();
    set({
      guides: state.guides.map((g) => (g.id === guide.id ? guide : g)),
    });
  },

  clearError: () => set({ error: null }),
}));
