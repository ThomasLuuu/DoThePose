import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SessionCapture } from '../screens/guides/SessionReviewScreen';

const MAX_RECENTS = 12;

interface SessionRecentsState {
  recents: SessionCapture[];
  addCapture: (capture: SessionCapture) => void;
  replaceSession: (captures: SessionCapture[]) => void;
  clear: () => void;
}

export const useSessionRecentsStore = create<SessionRecentsState>()(
  persist(
    (set) => ({
      recents: [],

      addCapture: (capture: SessionCapture) => {
        set((state) => {
          const withoutDupe = state.recents.filter((c) => c.id !== capture.id);
          const updated = [capture, ...withoutDupe];
          return { recents: updated.slice(0, MAX_RECENTS) };
        });
      },

      replaceSession: (captures: SessionCapture[]) => {
        set((state) => {
          const captureIds = new Set(captures.map((c) => c.id));
          const kept = state.recents.filter((c) => captureIds.has(c.id));
          const newOnes = captures.filter((c) => !state.recents.some((r) => r.id === c.id));
          const merged = [...newOnes, ...kept];
          return { recents: merged.slice(0, MAX_RECENTS) };
        });
      },

      clear: () => set({ recents: [] }),
    }),
    {
      name: 'session-recents',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ recents: state.recents }),
    },
  ),
);
