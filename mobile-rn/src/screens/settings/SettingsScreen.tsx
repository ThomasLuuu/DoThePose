import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
  Easing,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, fontSize, borderRadius, SemanticColors } from '../../config/theme';
import { useOnboardingStore } from '../../store/onboardingStore';
import { useSessionRecentsStore } from '../../store/sessionRecentsStore';
import { useSettingsStore } from '../../store/settingsStore';
import { listSavedPhotos, clearAllSavedPhotos } from '../../utils/savedPhotos';
import { useTheme } from '../../theme/ThemeContext';

// ─── Appearance Segment ───────────────────────────────────────────────────────

const PAD = 3;   // track padding
const GAP = 3;   // gap between segments
const TIMING = { duration: 240, easing: Easing.bezier(0.4, 0, 0.2, 1) };

const MODES = [
  { key: 'light', emoji: '🌤️', label: 'Light' },
  { key: 'dark',  emoji: '🌙',  label: 'Dark'  },
] as const;

interface AppearanceSegmentProps {
  current: 'system' | 'light' | 'dark';
  onChange: (v: 'system' | 'light' | 'dark') => void;
}

const AppearanceSegment: React.FC<AppearanceSegmentProps> = ({ current, onChange }) => {
  const { semantic } = useTheme();
  const styles = useMemo(() => makeSegmentStyles(semantic), [semantic]);

  // Shared values — readable on UI thread inside useAnimatedStyle
  const trackW = useSharedValue(0);
  const thumbPos = useSharedValue(current === 'dark' ? 1 : 0);
  const thumbOpacity = useSharedValue(current === 'system' ? 0 : 1);

  useEffect(() => {
    if (current === 'light') {
      thumbPos.value = withTiming(0, TIMING);
      thumbOpacity.value = withTiming(1, TIMING);
    } else if (current === 'dark') {
      thumbPos.value = withTiming(1, TIMING);
      thumbOpacity.value = withTiming(1, TIMING);
    } else {
      thumbOpacity.value = withTiming(0, TIMING);
    }
  }, [current]);

  const thumbAnimStyle = useAnimatedStyle(() => {
    if (trackW.value === 0) { return { opacity: 0, width: 0 }; }
    const segW = (trackW.value - PAD * 2 - GAP) / 2;
    return {
      width: segW,
      transform: [{ translateX: thumbPos.value * (segW + GAP) }],
      opacity: thumbOpacity.value,
    };
  });

  return (
    <View
      style={styles.track}
      onLayout={(e) => { trackW.value = e.nativeEvent.layout.width; }}
    >
      {/* Sliding thumb — sits behind the label rows */}
      <Animated.View style={[styles.thumb, thumbAnimStyle]} />

      {MODES.map(({ key, emoji, label }) => {
        const active = current === key;
        return (
          <TouchableOpacity
            key={key}
            style={styles.segment}
            onPress={() => onChange(active ? 'system' : key)}
            activeOpacity={0.75}
          >
            <Text style={styles.emoji}>{emoji}</Text>
            <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

function makeSegmentStyles(s: SemanticColors) {
  return StyleSheet.create({
    track: {
      flexDirection: 'row',
      backgroundColor: s.surfaceMuted,
      borderRadius: borderRadius.sm,
      margin: spacing.md,
      padding: PAD,
      gap: GAP,
      overflow: 'hidden',
    },
    // Absolutely-positioned thumb — animated translateX handles the slide
    thumb: {
      position: 'absolute',
      top: PAD,
      left: PAD,
      bottom: PAD,
      backgroundColor: s.surface,
      borderRadius: borderRadius.sm - 1,
    },
    segment: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm + 2,
      borderRadius: borderRadius.sm - 1,
    },
    emoji: {
      fontSize: 16,
    },
    label: {
      fontSize: fontSize.sm,
      fontWeight: '500',
      color: s.textSecondary,
    },
    labelActive: {
      color: s.text,
      fontWeight: '700',
    },
  });
}

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
}) => {
  const { semantic } = useTheme();
  const styles = useMemo(() => makeRowStyles(semantic), [semantic]);
  return (
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
            color={danger ? semantic.error : (iconColor ?? semantic.text)}
          />
        </View>
        <View style={styles.rowBody}>
          <Text style={[styles.rowLabel, danger && styles.dangerText]}>{label}</Text>
          {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
        </View>
        {right !== undefined ? right : onPress ? (
          <Ionicons name="chevron-forward" size={16} color={semantic.textSecondary} />
        ) : null}
      </TouchableOpacity>
      {!isLast && <View style={styles.divider} />}
    </>
  );
};

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, children }) => {
  const { semantic } = useTheme();
  const styles = useMemo(() => makeSectionStyles(semantic), [semantic]);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
};

// ─── Main Screen ─────────────────────────────────────────────────────────────

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { semantic } = useTheme();
  const styles = useMemo(() => makeScreenStyles(semantic), [semantic]);

  const resetOnboarding = useOnboardingStore((s) => s.resetOnboarding);
  const recentCount = useSessionRecentsStore((s) => s.recents.length);
  const clearRecents = useSessionRecentsStore((s) => s.clear);

  const notificationsEnabled = useSettingsStore((s) => s.notificationsEnabled);
  const setNotificationsEnabled = useSettingsStore((s) => s.setNotificationsEnabled);
  const appearance = useSettingsStore((s) => s.appearance);
  const setAppearance = useSettingsStore((s) => s.setAppearance);

  const [savedPhotoCount, setSavedPhotoCount] = useState(0);
  const [loadingSavedCount, setLoadingSavedCount] = useState(true);
  const [clearingSaved, setClearingSaved] = useState(false);

  const loadSavedPhotoCount = useCallback(async () => {
    setLoadingSavedCount(true);
    const photos = await listSavedPhotos();
    setSavedPhotoCount(photos.length);
    setLoadingSavedCount(false);
  }, []);

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

        {/* Appearance */}
        <Section title="Appearance">
          <AppearanceSegment current={appearance} onChange={setAppearance} />
        </Section>

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
                trackColor={{ false: semantic.surfaceMuted, true: semantic.primary }}
                thumbColor={semantic.text}
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
                <Ionicons name="chevron-forward" size={16} color={semantic.textSecondary} />
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
                <ActivityIndicator size="small" color={semantic.textSecondary} />
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
                <ActivityIndicator size="small" color={semantic.error} />
              ) : (
                <Ionicons name="chevron-forward" size={16} color={semantic.textSecondary} />
              )
            }
          />
        </Section>

      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Style factories ──────────────────────────────────────────────────────────

function makeRowStyles(s: SemanticColors) {
  return StyleSheet.create({
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
      backgroundColor: s.surfaceMuted,
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
      color: s.text,
      fontWeight: '500',
    },
    rowHint: {
      fontSize: fontSize.xs,
      color: s.textSecondary,
    },
    dangerText: {
      color: s.error,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: s.border,
      marginLeft: spacing.md + 32 + spacing.sm,
    },
  });
}

function makeSectionStyles(s: SemanticColors) {
  return StyleSheet.create({
    section: {
      gap: spacing.sm,
    },
    sectionTitle: {
      fontSize: fontSize.sm,
      fontWeight: '600',
      color: s.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      paddingHorizontal: spacing.xs,
    },
    card: {
      backgroundColor: s.surface,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: s.border,
      overflow: 'hidden',
    },
  });
}

function makeScreenStyles(s: SemanticColors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: s.background,
    },
    content: {
      padding: spacing.lg,
      gap: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: s.border,
      marginLeft: spacing.md + 32 + spacing.sm,
    },
    rowValueWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    rowValue: {
      fontSize: fontSize.sm,
      color: s.textSecondary,
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
      color: s.text,
    },
    statLabel: {
      fontSize: fontSize.xs,
      color: s.textSecondary,
    },
    statDivider: {
      width: StyleSheet.hairlineWidth,
      backgroundColor: s.border,
      marginVertical: spacing.xs,
    },
  });
}
