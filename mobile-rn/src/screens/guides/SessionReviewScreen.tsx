import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  Dimensions,
  ActivityIndicator,
  Share,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { dark, spacing, borderRadius, fontSize } from '../../config/theme';
import { sessionCallbackStore } from './sessionCallbackStore';
import { useSessionRecentsStore } from '../../store/sessionRecentsStore';

export type SessionCapture = {
  id: string;
  uri: string;
  createdAt: number;
};

type RouteParams = {
  SessionReview: {
    captures: SessionCapture[];
    poseName: string;
  };
};

const { width: SCREEN_W } = Dimensions.get('window');
const GRID_COLS = 3;
const GRID_GAP = 2;
const THUMB_W = (SCREEN_W - GRID_GAP * (GRID_COLS + 1)) / GRID_COLS;

export const SessionReviewScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'SessionReview'>>();
  const { poseName } = route.params;
  const insets = useSafeAreaInsets();

  const [captures, setCaptures] = useState<SessionCapture[]>(route.params.captures);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [heroUri, setHeroUri] = useState<string | null>(
    route.params.captures.length > 0 ? route.params.captures[route.params.captures.length - 1].uri : null,
  );
  const [saving, setSaving] = useState(false);
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();
  const replaceSession = useSessionRecentsStore((state) => state.replaceSession);

  const isSelectMode = selectedIds.size > 0;

  const capturesRef = useRef(captures);
  useEffect(() => {
    capturesRef.current = captures;
  }, [captures]);

  // Sync back to camera when navigating away via any gesture or hardware back
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      sessionCallbackStore.call(capturesRef.current);
      sessionCallbackStore.clear();
      replaceSession(capturesRef.current);
    });
    return unsubscribe;
  }, [navigation, replaceSession]);

  const toggleSelect = useCallback((item: SessionCapture) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }
      return next;
    });
    setHeroUri(item.uri);
  }, []);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleShare = useCallback(async () => {
    if (selectedIds.size === 0) { return; }
    const toShare = captures.filter((c) => selectedIds.has(c.id));
    if (toShare.length === 0) { return; }
    try {
      if (toShare.length === 1) {
        await Share.share({ url: toShare[0].uri });
      } else {
        // Share one at a time — iOS share sheet only accepts one URL at a time
        for (const capture of toShare) {
          await Share.share({ url: capture.uri });
        }
      }
    } catch (error: any) {
      if (error.message !== 'The user did not share') {
        Alert.alert('Share failed', 'Unable to share the selected photos.');
      }
    }
  }, [selectedIds, captures]);

  const handleDelete = useCallback(() => {
    if (selectedIds.size === 0) { return; }
    Alert.alert(
      'Delete Photos',
      `Delete ${selectedIds.size} selected photo${selectedIds.size > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const updated = captures.filter(c => !selectedIds.has(c.id));
            setCaptures(updated);
            setSelectedIds(new Set());
            setHeroUri(updated.length > 0 ? updated[updated.length - 1].uri : null);
          },
        },
      ],
    );
  }, [selectedIds, captures]);

  const handleSave = useCallback(async () => {
    if (selectedIds.size === 0) {
      Alert.alert('No Selection', 'Tap photos to select them before saving.');
      return;
    }

    // Ensure media library permission
    let perm = mediaPermission;
    if (!perm?.granted) {
      perm = await requestMediaPermission();
    }
    if (!perm?.granted) {
      Alert.alert(
        'Permission Required',
        'Allow access to your photo library to save images.',
        [{ text: 'OK' }],
      );
      return;
    }

    setSaving(true);
    const toSave = captures.filter(c => selectedIds.has(c.id));
    let savedCount = 0;
    const persistDir = `${FileSystem.documentDirectory}session_captures/`;
    try {
      // Ensure app persistent folder exists
      const dirInfo = await FileSystem.getInfoAsync(persistDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(persistDir, { intermediates: true });
      }

      for (const capture of toSave) {
        try {
          // Copy to app-persistent storage
          const filename = `${capture.id}.jpg`;
          const destPath = `${persistDir}${filename}`;
          const destInfo = await FileSystem.getInfoAsync(destPath);
          if (!destInfo.exists) {
            await FileSystem.copyAsync({ from: capture.uri, to: destPath });
          }

          // Save to device gallery
          await MediaLibrary.saveToLibraryAsync(destPath);
          savedCount++;
        } catch {
          // Continue saving remaining photos on individual failure
        }
      }

      setSaving(false);
      Alert.alert(
        'Saved',
        `${savedCount} photo${savedCount !== 1 ? 's' : ''} saved to your gallery.`,
      );
    } catch {
      setSaving(false);
      Alert.alert('Error', 'An error occurred while saving photos. Please try again.');
    }
  }, [selectedIds, captures, mediaPermission, requestMediaPermission]);

  const renderItem = useCallback(
    ({ item }: { item: SessionCapture }) => {
      const isSelected = selectedIds.has(item.id);
      return (
        <TouchableOpacity
          style={styles.gridItem}
          onPress={() => toggleSelect(item)}
          activeOpacity={0.8}
        >
          <Image source={{ uri: item.uri }} style={styles.gridThumb} resizeMode="cover" />
          {isSelected && (
            <View style={styles.checkOverlay}>
              <View style={styles.checkBadge}>
                <Ionicons name="checkmark" size={16} color="#000" />
              </View>
            </View>
          )}
          {!isSelected && (
            <View style={styles.uncheckedBadge} />
          )}
        </TouchableOpacity>
      );
    },
    [selectedIds, toggleSelect],
  );

  const keyExtractor = useCallback((item: SessionCapture) => item.id, []);

  return (
    <View style={styles.container}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
        <TouchableOpacity style={styles.headerIconBtn} onPress={handleBack}>
          <Ionicons name="chevron-back" size={22} color={dark.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Session Review</Text>
          <Text style={styles.headerSubtitle}>{poseName.toUpperCase()}</Text>
        </View>

        <TouchableOpacity style={styles.headerIconBtn} onPress={() => {
          if (selectedIds.size === captures.length) {
            setSelectedIds(new Set());
          } else {
            setSelectedIds(new Set(captures.map(c => c.id)));
          }
        }}>
          <Text style={styles.selectAllText}>
            {selectedIds.size === captures.length && captures.length > 0 ? 'None' : 'Select'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Hero preview ───────────────────────────────────────────────────── */}
      <View style={styles.heroWrapper}>
        {heroUri ? (
          <Image source={{ uri: heroUri }} style={styles.heroImage} resizeMode="cover" />
        ) : (
          <View style={styles.heroPlaceholder}>
            <Ionicons name="images-outline" size={48} color={dark.textSecondary} />
            <Text style={styles.heroPlaceholderText}>No photos in session</Text>
          </View>
        )}
        {captures.length > 0 && (
          <View style={styles.stackBadge}>
            <Ionicons name="layers" size={18} color={dark.text} />
          </View>
        )}
      </View>

      {/* ── Grid label ─────────────────────────────────────────────────────── */}
      <View style={styles.gridHeader}>
        <Text style={styles.gridHeaderText}>ALL PHOTOS ({captures.length})</Text>
      </View>

      {/* ── Photo grid ─────────────────────────────────────────────────────── */}
      <FlatList
        data={captures}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        numColumns={GRID_COLS}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.gridRow}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyGrid}>
            <Text style={styles.emptyText}>No photos yet. Take some from the camera!</Text>
          </View>
        }
      />

      {/* ── Bottom actions ─────────────────────────────────────────────────── */}
      <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
        {isSelectMode && (
          <View style={styles.selectionInfo}>
            <Text style={styles.selectionText}>{selectedIds.size} SELECTED</Text>
          </View>
        )}

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, !isSelectMode && styles.actionBtnDisabled]}
            onPress={handleDelete}
            disabled={!isSelectMode}
          >
            <Ionicons name="trash-outline" size={22} color={isSelectMode ? dark.text : dark.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, !isSelectMode && styles.actionBtnDisabled]}
            onPress={handleShare}
            disabled={!isSelectMode}
          >
            <Ionicons name="share-outline" size={22} color={isSelectMode ? dark.text : dark.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveBtn, !isSelectMode && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!isSelectMode || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Ionicons name="download-outline" size={20} color="#000" />
                <Text style={styles.saveBtnText}>
                  Save{isSelectMode ? ` (${selectedIds.size})` : ''}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: dark.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: dark.background,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: dark.text,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: dark.textSecondary,
    fontSize: fontSize.xs,
    letterSpacing: 0.5,
    marginTop: 1,
  },
  selectAllText: {
    color: dark.accent,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },

  // Hero
  heroWrapper: {
    width: SCREEN_W,
    height: SCREEN_W * 1.1,
    backgroundColor: dark.surface,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroPlaceholderText: {
    color: dark.textSecondary,
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
  },
  stackBadge: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Grid
  gridHeader: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  gridHeaderText: {
    color: dark.textSecondary,
    fontSize: fontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  grid: {
    paddingHorizontal: GRID_GAP,
    paddingBottom: 120,
  },
  gridRow: {
    marginBottom: GRID_GAP,
  },
  gridItem: {
    width: THUMB_W,
    height: THUMB_W,
    marginHorizontal: GRID_GAP / 2,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    backgroundColor: dark.surface,
  },
  gridThumb: {
    width: '100%',
    height: '100%',
  },
  checkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    padding: 6,
  },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: dark.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uncheckedBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    backgroundColor: 'transparent',
  },
  emptyGrid: {
    flex: 1,
    alignItems: 'center',
    paddingTop: spacing.xl,
  },
  emptyText: {
    color: dark.textSecondary,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: dark.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: dark.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  selectionInfo: {
    marginBottom: spacing.xs,
  },
  selectionText: {
    color: dark.accent,
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: dark.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnDisabled: {
    opacity: 0.4,
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: dark.accent,
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    color: '#000',
    fontSize: fontSize.md,
    fontWeight: '700',
  },
});
