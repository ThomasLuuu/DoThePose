import React, { useMemo } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, fontSize, borderRadius } from '../../../config/theme';
import { SemanticColors } from '../../../config/theme';
import { useTheme } from '../../../theme/ThemeContext';

export interface InfoSection {
  heading: string;
  body: string;
}

interface Props {
  sections: InfoSection[];
  footer?: string;
}

export const StaticInfoPage: React.FC<Props> = ({ sections, footer }) => {
  const { semantic } = useTheme();
  const styles = useMemo(() => makeStyles(semantic), [semantic]);

  return (
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
};

function makeStyles(s: SemanticColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: s.background },
    content: { padding: spacing.lg, gap: spacing.lg },
    section: {
      backgroundColor: s.surface,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: s.border,
      padding: spacing.md,
      gap: spacing.sm,
    },
    heading: { fontSize: fontSize.md, fontWeight: '700', color: s.text },
    body: { fontSize: fontSize.sm, color: s.textSecondary, lineHeight: fontSize.sm * 1.6 },
    footer: { fontSize: fontSize.xs, color: s.textSecondary, textAlign: 'center', paddingVertical: spacing.md },
  });
}
