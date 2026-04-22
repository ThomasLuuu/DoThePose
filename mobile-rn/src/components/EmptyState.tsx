import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, dark, spacing, fontSize } from '../config/theme';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  /** Use dark palette (home screen) */
  variant?: 'light' | 'dark';
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  subtitle,
  action,
  variant = 'light',
}) => {
  const isDark = variant === 'dark';
  const iconColor = isDark ? dark.primary : colors.primary;
  const titleColor = isDark ? dark.text : colors.text;
  const subtitleColor = isDark ? dark.textSecondary : colors.textLight;

  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={80} color={iconColor} style={styles.icon} />
      <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: subtitleColor }]}>{subtitle}</Text>
      ) : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  icon: {
    opacity: 0.5,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.md,
    textAlign: 'center',
  },
  action: {
    marginTop: spacing.lg,
  },
});
