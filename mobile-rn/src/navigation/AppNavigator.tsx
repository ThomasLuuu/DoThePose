import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { dark } from '../config/theme';

import { HomeScreen } from '../screens/home/HomeScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { GuideViewerScreen } from '../screens/guides/GuideViewerScreen';
import { EditGuideScreen } from '../screens/guides/EditGuideScreen';
import { CropRotateScreen } from '../screens/guides/CropRotateScreen';
import { CameraOverlayScreen } from '../screens/guides/CameraOverlayScreen';
import { SessionReviewScreen } from '../screens/guides/SessionReviewScreen';
import { ProcessingScreen } from '../screens/processing/ProcessingScreen';

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
  return (
    <NavigationContainer theme={navDarkTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: true,
          headerStyle: { backgroundColor: dark.background },
          headerTintColor: dark.text,
          headerTitleStyle: { color: dark.text },
          headerShadowVisible: false,
        }}
      >
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
      </Stack.Navigator>
    </NavigationContainer>
  );
};
