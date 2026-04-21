import React from 'react';
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
import { colors, spacing, borderRadius, fontSize } from '../config/theme';

interface GuideCardProps {
  guide: Guide;
  onPress?: () => void;
  onLongPress?: () => void;
}

export const GuideCard: React.FC<GuideCardProps> = ({
  guide,
  onPress,
  onLongPress,
}) => {
  const thumbnailUrl = getFullImageUrl(guide.thumbnailUrl);
  const isReady = guide.status === 'completed';
  const isProcessing = guide.status === 'pending' || guide.status === 'processing';
  const hasFailed = guide.status === 'failed';
  const isFavorite = Boolean(guide.favorite);
  const hasPose = Boolean(guide.layers?.pose);
  const hasHorizon = Boolean(guide.layers?.horizon);
  const hasSun = Boolean(guide.layers?.sun);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={isReady ? onPress : undefined}
      onLongPress={onLongPress}
      activeOpacity={isReady ? 0.7 : 1}
    >
      <View style={styles.imageContainer}>
        {thumbnailUrl ? (
          <Image source={{ uri: thumbnailUrl }} style={styles.image} />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="image-outline" size={48} color={colors.textLight} />
          </View>
        )}

        {!isReady && (
          <View style={styles.overlay}>
            {isProcessing ? (
              <>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.overlayText}>Processing...</Text>
              </>
            ) : hasFailed ? (
              <>
                <Ionicons name="alert-circle-outline" size={32} color="#fff" />
                <Text style={styles.overlayText}>Failed</Text>
              </>
            ) : null}
          </View>
        )}

        {isFavorite && (
          <View style={styles.favoriteBadge}>
            <Ionicons name="heart" size={16} color={colors.error} />
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.date}>{formatDate(guide.createdAt)}</Text>
        <View style={styles.layers}>
          {hasPose && (
            <Ionicons name="body-outline" size={14} color={colors.primary} style={styles.layerIcon} />
          )}
          {hasHorizon && (
            <Ionicons name="remove-outline" size={14} color={colors.primary} style={styles.layerIcon} />
          )}
          {hasSun && (
            <Ionicons name="sunny-outline" size={14} color={colors.primary} style={styles.layerIcon} />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    margin: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imageContainer: {
    aspectRatio: 1,
    backgroundColor: colors.border,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayText: {
    color: '#fff',
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
  },
  favoriteBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: borderRadius.full,
    padding: spacing.xs,
  },
  footer: {
    padding: spacing.sm,
  },
  date: {
    fontSize: fontSize.xs,
    color: colors.textLight,
  },
  layers: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  layerIcon: {
    marginRight: spacing.xs,
  },
});
