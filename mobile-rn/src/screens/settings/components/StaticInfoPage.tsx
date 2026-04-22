import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { dark, spacing, fontSize, borderRadius } from '../../../config/theme';

export interface InfoSection {
  heading: string;
  body: string;
}

interface Props {
  sections: InfoSection[];
  footer?: string;
}

export const StaticInfoPage: React.FC<Props> = ({ sections, footer }) => (
  <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
    <ScrollView contentContainerStyle={styles.content}>
      {sections.map((section, i) => (
        <View key={i} style={styles.section}>
          <Text style={styles.heading}>{section.heading}</Text>
          <Text style={styles.body}>{section.body}</Text>
        </View>
      ))}
      {footer ? <Text style={styles.footer}>{footer}</Text> : null}
    </ScrollView>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: dark.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  section: {
    backgroundColor: dark.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: dark.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  heading: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: dark.text,
  },
  body: {
    fontSize: fontSize.sm,
    color: dark.textSecondary,
    lineHeight: fontSize.sm * 1.6,
  },
  footer: {
    fontSize: fontSize.xs,
    color: dark.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
});
