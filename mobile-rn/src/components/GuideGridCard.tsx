import React, { useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Guide } from '../types/guide';
import { getFullImageUrl } from '../config/api';
import { spacing, borderRadius, fontSize } from '../config/theme';
import { SemanticColors } from '../config/theme';
import { useTheme } from '../theme/ThemeContext';

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    if (diffHours <= 0) { return 'Just now'; }
    return diffHours === 1 ? '1h ago' : `${diffHours}h ago`;
  }
  if (diffDays === 1) { return 'Yesterday'; }
  if (diffDays < 7) { return `${diffDays} days ago`; }
  if (diffDays < 30) { return 'Last week'; }
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

interface GuideGridCardProps {
  guide: Guide;
  width: number;
  selected?: boolean;
  selectionMode?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  onToggleFavorite?: () => void;
}

export const GuideGridCard: React.FC<GuideGridCardProps> = React.memo(({
  guide,
  width,
  selected,
  selectionMode,
  onPress,
  onLongPress,
  onToggleFavorite,
}) => {
  const { semantic } = useTheme();
  const styles = useMemo(() => makeStyles(semantic), [semantic]);
  const thumbnailUrl = getFullImageUrl(guide.thumbnailUrl);
  const isReady = guide.status === 'completed';
  const isProcessing = guide.status === 'pending' || guide.status === 'processing';
  const isFailed = guide.status === 'failed';

  const title = guide.name?.trim() ? guide.name.trim() : 'Untitled';
  const subtitle = formatRelativeDate(guide.createdAt);

  return (
    <TouchableOpacity
      style={[{ width }, styles.card]}
      activeOpacity={0.85}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <View style={[styles.thumbWrap, { width, height: width * 1.25 }]}>
        {thumbnailUrl ? (
          <Image source={{ uri: thumbnailUrl }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={[styles.thumb, styles.placeholder]}>
            <Ionicons name="image-outline" size={32} color={semantic.textSecondary} />
          </View>
        )}
        {isProcessing ? (
          <View style={styles.overlay}>
            <ActivityIndicator color={semantic.text} />
            <Text style={styles.overlayHint}>Tap to track</Text>
          </View>
        ) : null}
        {isFailed ? (
          <View style={styles.overlay}>
            <Ionicons name="alert-circle-outline" size={28} color={semantic.error} />
            <Text style={styles.overlayHint}>Failed</Text>
          </View>
        ) : null}

        {selectionMode ? (
          <View style={[styles.selectBadge, selected && styles.selectBadgeOn]}>
            {selected ? <Ionicons name="checkmark" size={16} color={semantic.accentText} /> : null}
          </View>
        ) : (
          <TouchableOpacity
            style={styles.heart}
            onPress={onToggleFavorite}
            accessibilityLabel={guide.favorite ? 'Unfavorite' : 'Favorite'}
            hitSlop={8}
          >
            <Ionicons
              name={guide.favorite ? 'heart' : 'heart-outline'}
              size={20}
              color={guide.favorite ? semantic.accent : semantic.text}
            />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.meta}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {isProcessing ? 'Processing…' : isFailed ? 'Failed' : isReady ? subtitle : subtitle}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

interface NewGuideTileProps {
  width: number;
  onPress?: () => void;
}

export const NewGuideTile: React.FC<NewGuideTileProps> = React.memo(({ width, onPress }) => {
  const { semantic } = useTheme();
  const styles = useMemo(() => makeStyles(semantic), [semantic]);
  return (
    <TouchableOpacity
      style={[{ width }, styles.card]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <View style={[styles.newTile, { width, height: width * 1.25 }]}>
        <View style={styles.newIconRing}>
          <Ionicons name="add" size={28} color={semantic.accent} />
        </View>
        <Text style={styles.newLabel}>New Guide</Text>
      </View>
    </TouchableOpacity>
  );
});

function makeStyles(s: SemanticColors) {
  return StyleSheet.create({
    card: {
      marginBottom: spacing.md,
    },
    thumbWrap: {
      borderRadius: borderRadius.lg,
      overflow: 'hidden',
      backgroundColor: s.surface,
      position: 'relative',
    },
    thumb: {
      width: '100%',
      height: '100%',
    },
    placeholder: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: s.surfaceMuted,
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    overlayHint: {
      fontSize: fontSize.xs,
      fontWeight: '600',
      color: 'rgba(255,255,255,0.85)',
      letterSpacing: 0.5,
    },
    heart: {
      position: 'absolute',
      top: spacing.sm,
      right: spacing.sm,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    selectBadge: {
      position: 'absolute',
      top: spacing.sm,
      right: spacing.sm,
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 2,
      borderColor: s.text,
      backgroundColor: 'rgba(0,0,0,0.35)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    selectBadgeOn: {
      backgroundColor: s.accent,
      borderColor: s.accent,
    },
    meta: {
      paddingTop: spacing.sm,
    },
    title: {
      fontSize: fontSize.md,
      fontWeight: '700',
      color: s.text,
    },
    subtitle: {
      fontSize: fontSize.xs,
      color: s.textSecondary,
      marginTop: 2,
    },
    newTile: {
      borderRadius: borderRadius.lg,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: s.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    newIconRing: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: s.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    newLabel: {
      fontSize: fontSize.sm,
      color: s.textSecondary,
      fontWeight: '600',
    },
  });
}
