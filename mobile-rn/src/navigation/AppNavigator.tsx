import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../config/theme';

import { UploadScreen } from '../screens/upload/UploadScreen';
import { SavedGuidesScreen } from '../screens/guides/SavedGuidesScreen';
import { GuideViewerScreen } from '../screens/guides/GuideViewerScreen';
import { CameraOverlayScreen } from '../screens/guides/CameraOverlayScreen';
import { ProcessingScreen } from '../screens/processing/ProcessingScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textLight,
        headerShown: true,
      }}
    >
      <Tab.Screen
        name="Create"
        component={UploadScreen}
        options={{
          title: 'Create Pose Guide',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="add-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Saved"
        component={SavedGuidesScreen}
        options={{
          title: 'Saved Guides',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="images-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: true,
        }}
      >
        <Stack.Screen
          name="Main"
          component={TabNavigator}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Processing"
          component={ProcessingScreen}
          options={{
            title: 'Processing',
            presentation: 'modal',
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
          name="CameraOverlay"
          component={CameraOverlayScreen}
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
