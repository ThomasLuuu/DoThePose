import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface OnboardingState {
  hasCompletedOnboarding: boolean;
  completeOnboarding: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      hasCompletedOnboarding: false,

      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
    }),
    {
      name: 'onboarding',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ hasCompletedOnboarding: state.hasCompletedOnboarding }),
    },
  ),
);
