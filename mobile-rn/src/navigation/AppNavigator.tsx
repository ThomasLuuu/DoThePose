import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useOnboardingStore } from '../store/onboardingStore';
import { useTheme } from '../theme/ThemeContext';

import { HomeScreen } from '../screens/home/HomeScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { GuideViewerScreen } from '../screens/guides/GuideViewerScreen';
import { GuideDetailsScreen } from '../screens/guides/GuideDetailsScreen';
import { EditGuideScreen } from '../screens/guides/EditGuideScreen';
import { CropRotateScreen } from '../screens/guides/CropRotateScreen';
import { CameraOverlayScreen } from '../screens/guides/CameraOverlayScreen';
import { SessionReviewScreen } from '../screens/guides/SessionReviewScreen';
import { GroupScreen } from '../screens/guides/GroupScreen';
import { ProcessingScreen } from '../screens/processing/ProcessingScreen';
import { SavedGalleryScreen } from '../screens/gallery/SavedGalleryScreen';
import { SavedPhotoDetailsScreen } from '../screens/gallery/SavedPhotoDetailsScreen';
import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen';
import { TermsScreen } from '../screens/settings/TermsScreen';
import { PrivacyScreen } from '../screens/settings/PrivacyScreen';
import { HelpScreen } from '../screens/settings/HelpScreen';

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

  return (
    <NavigationContainer theme={navTheme}>
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
    </NavigationContainer>
  );
};
