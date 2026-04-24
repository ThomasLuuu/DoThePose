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
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) { return 'Today'; }
  if (diffDays === 1) { return 'Yesterday'; }
  if (diffDays < 7) { return `${diffDays} days ago`; }
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

function statusSubtitle(guide: Guide): string {
  if (guide.status === 'completed') {
    return guide.favorite ? 'Favorite · Pose guide' : 'Pose guide';
  }
  if (guide.status === 'pending' || guide.status === 'processing') {
    return 'Processing — tap to track';
  }
  if (guide.status === 'failed') {
    return 'Failed';
  }
  return guide.status;
}

interface GuideListRowProps {
  guide: Guide;
  onPress?: () => void;
  onLongPress?: () => void;
}

export const GuideListRow: React.FC<GuideListRowProps> = ({
  guide,
  onPress,
  onLongPress,
}) => {
  const { semantic } = useTheme();
  const styles = useMemo(() => makeStyles(semantic), [semantic]);
  const thumbnailUrl = getFullImageUrl(guide.thumbnailUrl);
  const isReady = guide.status === 'completed';
  const isProcessing = guide.status === 'pending' || guide.status === 'processing';

  const title = guide.name?.trim() ? guide.name.trim() : formatRelativeDate(guide.createdAt);
  const subtitle = statusSubtitle(guide);

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      <View style={styles.leading}>
        {thumbnailUrl ? (
          <Image source={{ uri: thumbnailUrl }} style={styles.thumb} />
        ) : (
          <View style={styles.thumbPlaceholder}>
            <Ionicons name="folder-outline" size={22} color={semantic.textSecondary} />
          </View>
        )}
        {isProcessing ? (
          <View style={styles.processingBadge}>
            <ActivityIndicator size="small" color={semantic.text} />
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={semantic.textSecondary} />
    </TouchableOpacity>
  );
};

function makeStyles(s: SemanticColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: s.surface,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.sm,
      minHeight: 72,
    },
    leading: {
      marginRight: spacing.md,
    },
    thumb: {
      width: 44,
      height: 44,
      borderRadius: borderRadius.sm,
      backgroundColor: s.surfaceMuted,
    },
    thumbPlaceholder: {
      width: 44,
      height: 44,
      borderRadius: borderRadius.sm,
      backgroundColor: s.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    processingBadge: {
      position: 'absolute',
      right: -4,
      bottom: -4,
    },
    body: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      fontSize: fontSize.md,
      fontWeight: '600',
      color: s.text,
    },
    subtitle: {
      fontSize: fontSize.sm,
      color: s.textSecondary,
      marginTop: 3,
    },
  });
}
