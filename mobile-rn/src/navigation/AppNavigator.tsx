import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useOnboardingStore } from '../store/onboardingStore';
import { useTheme } from '../theme/ThemeContext';

import { HomeScreen } from '../screens/home/HomeScreen';
import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen';

const SettingsScreen = lazy(() =>
  import('../screens/settings/SettingsScreen').then((m) => ({ default: m.SettingsScreen })),
);
const GuideViewerScreen = lazy(() =>
  import('../screens/guides/GuideViewerScreen').then((m) => ({ default: m.GuideViewerScreen })),
);
const GuideDetailsScreen = lazy(() =>
  import('../screens/guides/GuideDetailsScreen').then((m) => ({ default: m.GuideDetailsScreen })),
);
const EditGuideScreen = lazy(() =>
  import('../screens/guides/EditGuideScreen').then((m) => ({ default: m.EditGuideScreen })),
);
const CropRotateScreen = lazy(() =>
  import('../screens/guides/CropRotateScreen').then((m) => ({ default: m.CropRotateScreen })),
);
const CameraOverlayScreen = lazy(() =>
  import('../screens/guides/CameraOverlayScreen').then((m) => ({ default: m.CameraOverlayScreen })),
);
const SessionReviewScreen = lazy(() =>
  import('../screens/guides/SessionReviewScreen').then((m) => ({ default: m.SessionReviewScreen })),
);
const GroupScreen = lazy(() =>
  import('../screens/guides/GroupScreen').then((m) => ({ default: m.GroupScreen })),
);
const ProcessingScreen = lazy(() =>
  import('../screens/processing/ProcessingScreen').then((m) => ({ default: m.ProcessingScreen })),
);
const SavedGalleryScreen = lazy(() =>
  import('../screens/gallery/SavedGalleryScreen').then((m) => ({ default: m.SavedGalleryScreen })),
);
const SavedPhotoDetailsScreen = lazy(() =>
  import('../screens/gallery/SavedPhotoDetailsScreen').then((m) => ({ default: m.SavedPhotoDetailsScreen })),
);
const TermsScreen = lazy(() =>
  import('../screens/settings/TermsScreen').then((m) => ({ default: m.TermsScreen })),
);
const PrivacyScreen = lazy(() =>
  import('../screens/settings/PrivacyScreen').then((m) => ({ default: m.PrivacyScreen })),
);
const HelpScreen = lazy(() =>
  import('../screens/settings/HelpScreen').then((m) => ({ default: m.HelpScreen })),
);

const Stack = createNativeStackNavigator();

export const AppNavigator = () => {
  const { semantic, isDark } = useTheme();
  const hasCompletedOnboarding = useOnboardingStore((s) => s.hasCompletedOnboarding);
  const [onboardingHydrated, setOnboardingHydrated] = useState(() =>
    useOnboardingStore.persist.hasHydrated(),
  );

  useEffect(() => {
    const unsub = useOnboardingStore.persist.onFinishHydration(() => {
      setOnboardingHydrated(true);
    });
    if (useOnboardingStore.persist.hasHydrated()) {
      setOnboardingHydrated(true);
    }
    return unsub;
  }, []);

  const navTheme = useMemo(() => ({
    ...DefaultTheme,
    dark: isDark,
    colors: {
      ...DefaultTheme.colors,
      primary: semantic.primary,
      background: semantic.background,
      card: semantic.surface,
      text: semantic.text,
      border: semantic.border,
      notification: semantic.primary,
    },
  }), [semantic, isDark]);

  if (!onboardingHydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: semantic.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={semantic.accent} size="large" />
      </View>
    );
  }

  const initialRouteName = hasCompletedOnboarding ? 'Main' : 'Onboarding';

  const suspenseFallback = (
    <View style={{ flex: 1, backgroundColor: semantic.background, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={semantic.accent} size="large" />
    </View>
  );

  return (
    <NavigationContainer theme={navTheme}>
      <Suspense fallback={suspenseFallback}>
        <Stack.Navigator
          initialRouteName={initialRouteName}
          screenOptions={{
            headerShown: true,
            headerStyle: { backgroundColor: semantic.background },
            headerTintColor: semantic.text,
            headerTitleStyle: { color: semantic.text },
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen
            name="Onboarding"
            component={OnboardingScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Main"
            component={HomeScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ title: 'Settings' }}
          />
          <Stack.Screen
            name="Terms"
            component={TermsScreen}
            options={{ title: 'Terms & Conditions' }}
          />
          <Stack.Screen
            name="Privacy"
            component={PrivacyScreen}
            options={{ title: 'Privacy Policy' }}
          />
          <Stack.Screen
            name="Help"
            component={HelpScreen}
            options={{ title: 'Help' }}
          />
          <Stack.Screen
            name="Processing"
            component={ProcessingScreen}
            options={{
              headerShown: false,
              presentation: 'modal',
            }}
          />
          <Stack.Screen
            name="EditGuide"
            component={EditGuideScreen}
            options={{
              headerShown: false,
              presentation: 'fullScreenModal',
            }}
          />
          <Stack.Screen
            name="GuideViewer"
            component={GuideViewerScreen}
            options={{
              headerShown: false,
              presentation: 'fullScreenModal',
            }}
          />
          <Stack.Screen
            name="GuideDetails"
            component={GuideDetailsScreen}
            options={{
              headerShown: false,
              presentation: 'fullScreenModal',
            }}
          />
          <Stack.Screen
            name="CropRotate"
            component={CropRotateScreen}
            options={{
              headerShown: false,
              presentation: 'fullScreenModal',
            }}
          />
          <Stack.Screen
            name="CameraOverlay"
            component={CameraOverlayScreen}
            options={{
              headerShown: false,
              presentation: 'fullScreenModal',
            }}
          />
          <Stack.Screen
            name="SessionReview"
            component={SessionReviewScreen}
            options={{
              headerShown: false,
              presentation: 'fullScreenModal',
            }}
          />
          <Stack.Screen
            name="Group"
            component={GroupScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="SavedGallery"
            component={SavedGalleryScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="SavedPhotoDetails"
            component={SavedPhotoDetailsScreen}
            options={{ headerShown: false }}
          />
        </Stack.Navigator>
      </Suspense>
    </NavigationContainer>
  );
};
