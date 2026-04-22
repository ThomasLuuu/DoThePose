import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { dark, spacing, fontSize, borderRadius } from '../../config/theme';
import { useOnboardingStore } from '../../store/onboardingStore';
import { useSessionRecentsStore } from '../../store/sessionRecentsStore';
import { useSettingsStore } from '../../store/settingsStore';
import { listSavedPhotos, clearAllSavedPhotos } from '../../utils/savedPhotos';

// ─── Sub-components ──────────────────────────────────────────────────────────

interface RowProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconColor?: string;
  label: string;
  hint?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
}

const Row: React.FC<RowProps> = ({
  icon,
  iconColor,
  label,
  hint,
  onPress,
  right,
  danger,
  disabled,
  isFirst,
  isLast,
}) => (
  <>
    <TouchableOpacity
      style={[styles.row, disabled && styles.rowDisabled]}
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
      disabled={disabled || !onPress}
    >
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
        <Ionicons
          name={icon}
          size={17}
          color={danger ? dark.error : (iconColor ?? dark.text)}
        />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowLabel, danger && styles.dangerText]}>{label}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
      {right !== undefined ? right : onPress ? (
        <Ionicons name="chevron-forward" size={16} color={dark.textSecondary} />
      ) : null}
    </TouchableOpacity>
    {!isLast && <View style={styles.divider} />}
  </>
);

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.card}>{children}</View>
  </View>
);

// ─── Main Screen ─────────────────────────────────────────────────────────────

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  const resetOnboarding = useOnboardingStore((s) => s.resetOnboarding);
  const recentCount = useSessionRecentsStore((s) => s.recents.length);
  const clearRecents = useSessionRecentsStore((s) => s.clear);

  const notificationsEnabled = useSettingsStore((s) => s.notificationsEnabled);
  const setNotificationsEnabled = useSettingsStore((s) => s.setNotificationsEnabled);

  const [savedPhotoCount, setSavedPhotoCount] = useState(0);
  const [loadingSavedCount, setLoadingSavedCount] = useState(true);
  const [clearingSaved, setClearingSaved] = useState(false);

  const loadSavedPhotoCount = useCallback(async () => {
    setLoadingSavedCount(true);
    const photos = await listSavedPhotos();
    setSavedPhotoCount(photos.length);
    setLoadingSavedCount(false);
  }, []);

  useEffect(() => {
    loadSavedPhotoCount();
  }, [loadSavedPhotoCount]);

  useFocusEffect(
    useCallback(() => {
      loadSavedPhotoCount();
    }, [loadSavedPhotoCount]),
  );

  const handleReplayOnboarding = useCallback(() => {
    Alert.alert(
      'Replay onboarding?',
      'This will open the onboarding flow again right away.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Replay',
          onPress: () => {
            resetOnboarding();
            navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
          },
        },
      ],
    );
  }, [navigation, resetOnboarding]);

  const handleClearRecents = useCallback(() => {
    if (recentCount === 0) {
      Alert.alert('No recent photos', 'Your recent strip is already empty.');
      return;
    }
    Alert.alert(
      'Clear recent photos?',
      'This removes only the recent session list on Home. Files in Gallery are not deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            clearRecents();
            Alert.alert('Done', 'Recent photos list has been cleared.');
          },
        },
      ],
    );
  }, [clearRecents, recentCount]);

  const handleClearSavedPhotos = useCallback(() => {
    if (savedPhotoCount === 0) {
      Alert.alert('No saved photos', 'Gallery storage is already empty.');
      return;
    }
    Alert.alert(
      'Delete all gallery photos?',
      'This will permanently remove all photos saved by camera sessions from device storage.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete all',
          style: 'destructive',
          onPress: async () => {
            setClearingSaved(true);
            const deletedCount = await clearAllSavedPhotos();
            setClearingSaved(false);
            await loadSavedPhotoCount();
            Alert.alert('Storage cleaned', `Deleted ${deletedCount} saved photo(s).`);
          },
        },
      ],
    );
  }, [loadSavedPhotoCount, savedPhotoCount]);

  const handleLanguage = useCallback(() => {
    Alert.alert('Language', 'Additional language support is coming soon.');
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* Preferences */}
        <Section title="Preferences">
          <Row
            icon="notifications-outline"
            label="Notifications"
            isFirst
            right={
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: dark.surfaceMuted, true: dark.primary }}
                thumbColor={dark.text}
              />
            }
          />
          <Row
            icon="sunny-outline"
            label="Light Mode"
            hint="Coming soon"
            disabled
            right={
              <Switch
                value={false}
                disabled
                trackColor={{ false: dark.surfaceMuted, true: dark.primary }}
                thumbColor={dark.textSecondary}
              />
            }
          />
          <Row
            icon="language-outline"
            label="Language"
            onPress={handleLanguage}
            right={
              <View style={styles.rowValueWrap}>
                <Text style={styles.rowValue}>English</Text>
                <Ionicons name="chevron-forward" size={16} color={dark.textSecondary} />
              </View>
            }
            isLast
          />
        </Section>

        {/* Information */}
        <Section title="Information">
          <Row
            icon="document-text-outline"
            label="Terms & Conditions"
            onPress={() => navigation.navigate('Terms')}
            isFirst
          />
          <Row
            icon="shield-checkmark-outline"
            label="Privacy Policy"
            onPress={() => navigation.navigate('Privacy')}
          />
          <Row
            icon="help-circle-outline"
            label="Help"
            onPress={() => navigation.navigate('Help')}
            isLast
          />
        </Section>

        {/* Storage & App */}
        <Section title="Storage & App">
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{recentCount}</Text>
              <Text style={styles.statLabel}>Recents</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              {loadingSavedCount ? (
                <ActivityIndicator size="small" color={dark.textSecondary} />
              ) : (
                <Text style={styles.statValue}>{savedPhotoCount}</Text>
              )}
              <Text style={styles.statLabel}>Saved photos</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <Row
            icon="time-outline"
            label="Clear recent strip"
            hint="Resets Home recents; gallery files are untouched."
            onPress={handleClearRecents}
          />
          <Row
            icon="play-circle-outline"
            label="Replay onboarding"
            hint="Show the intro flow again from the beginning."
            onPress={handleReplayOnboarding}
          />
          <Row
            icon="trash-outline"
            label="Delete all gallery photos"
            hint="Permanently removes all photos from local storage."
            onPress={handleClearSavedPhotos}
            danger
            disabled={clearingSaved}
            isLast
            right={
              clearingSaved ? (
                <ActivityIndicator size="small" color={dark.error} />
              ) : (
                <Ionicons name="chevron-forward" size={16} color={dark.textSecondary} />
              )
            }
          />
        </Section>

      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: dark.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: dark.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: spacing.xs,
  },
  card: {
    backgroundColor: dark.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: dark.border,
    overflow: 'hidden',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: dark.border,
    marginLeft: spacing.md + 32 + spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  rowDisabled: {
    opacity: 0.45,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    backgroundColor: dark.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconDanger: {
    backgroundColor: 'rgba(239,68,68,0.15)',
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: fontSize.md,
    color: dark.text,
    fontWeight: '500',
  },
  rowHint: {
    fontSize: fontSize.xs,
    color: dark.textSecondary,
  },
  rowValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rowValue: {
    fontSize: fontSize.sm,
    color: dark.textSecondary,
  },
  dangerText: {
    color: dark.error,
  },
  statsRow: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: dark.text,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: dark.textSecondary,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: dark.border,
    marginVertical: spacing.xs,
  },
});
