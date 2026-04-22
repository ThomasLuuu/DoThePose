import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { dark, spacing, fontSize } from '../../config/theme';

export const SettingsScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>PoseGuide</Text>
        <Text style={styles.hint}>
          App settings will appear here. Use the back button to return home.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: dark.background,
  },
  content: {
    padding: spacing.lg,
  },
  label: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: dark.text,
    marginBottom: spacing.sm,
  },
  hint: {
    fontSize: fontSize.md,
    color: dark.textSecondary,
    lineHeight: 22,
  },
});
