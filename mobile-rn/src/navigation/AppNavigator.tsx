import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { dark } from '../config/theme';
import { useOnboardingStore } from '../store/onboardingStore';

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

const Stack = createNativeStackNavigator();

const navDarkTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: dark.primary,
    background: dark.background,
    card: dark.surface,
    text: dark.text,
    border: dark.border,
    notification: dark.primary,
  },
};

export const AppNavigator = () => {
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

  if (!onboardingHydrated) {
    return (
      <View style={styles.hydrate}>
        <ActivityIndicator color={dark.accent} size="large" />
      </View>
    );
  }

  const initialRouteName = hasCompletedOnboarding ? 'Main' : 'Onboarding';

  return (
    <NavigationContainer theme={navDarkTheme}>
      <Stack.Navigator
        initialRouteName={initialRouteName}
        screenOptions={{
          headerShown: true,
          headerStyle: { backgroundColor: dark.background },
          headerTintColor: dark.text,
          headerTitleStyle: { color: dark.text },
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

const styles = StyleSheet.create({
  hydrate: {
    flex: 1,
    backgroundColor: dark.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
