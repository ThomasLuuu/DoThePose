import { create } from 'zustand';

interface PendingUploadState {
  pendingUri: string | null;
  setPendingUri: (uri: string | null) => void;
}

export const usePendingUploadStore = create<PendingUploadState>()((set) => ({
  pendingUri: null,
  setPendingUri: (uri) => set({ pendingUri: uri }),
}));
