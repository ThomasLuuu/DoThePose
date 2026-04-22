import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { dark, spacing, borderRadius, fontSize } from '../../config/theme';
import { Guide } from '../../types/guide';
import { apiClient } from '../../api/client';
import { useGroupsStore } from '../../store/groupsStore';
import { useGuidesStore } from '../../store/guidesStore';
import { GuideGridCard, NewGuideTile } from '../../components/GuideGridCard';
import { AddToGroupModal } from '../../components/AddToGroupModal';
import { CREATED_GROUP_ID } from '../../types/group';

type RouteParams = {
  Group: {
    groupId: string;
    groupName: string;
  };
};

type Filter = 'all' | 'favorites';

const { width: SCREEN_W } = Dimensions.get('window');
const GRID_COLS = 2;
const GRID_GAP = spacing.md;
const HORIZONTAL_PADDING = spacing.md;
const CARD_W = (SCREEN_W - HORIZONTAL_PADDING * 2 - GRID_GAP) / GRID_COLS;

export const GroupScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'Group'>>();
  const { groupId, groupName: initialName } = route.params;
  const isVirtual = groupId === CREATED_GROUP_ID;

  const groups = useGroupsStore((s) => s.groups);
  const loadGroups = useGroupsStore((s) => s.loadGroups);
  const createGroupAction = useGroupsStore((s) => s.createGroup);
  const addGuidesToGroupAction = useGroupsStore((s) => s.addGuidesToGroup);
  const removeGuidesFromGroupAction = useGroupsStore((s) => s.removeGuidesFromGroup);
  const addGuideToStore = useGuidesStore((s) => s.addGuide);
  const toggleFavoriteAction = useGuidesStore((s) => s.toggleFavorite);
  const updateGuideInList = useGuidesStore((s) => s.updateGuideInList);

  const [guides, setGuides] = useState<Guide[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addToGroupOpen, setAddToGroupOpen] = useState(false);

  const currentGroup = useMemo(
    () => (isVirtual ? null : groups.find((g) => g.id === groupId)),
    [groups, groupId, isVirtual],
  );
  const headerTitle = isVirtual ? initialName : (currentGroup?.name ?? initialName);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.getGroupGuides(groupId, 1, 100);
      setGuides(res.guides);
      setTotal(res.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load guides');
    } finally {
      setIsLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      loadGroups();
      load();
    }, [loadGroups, load]),
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return guides.filter((g) => {
      if (filter === 'favorites' && !g.favorite) { return false; }
      if (needle && !g.name.toLowerCase().includes(needle)) { return false; }
      return true;
    });
  }, [guides, search, filter]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }, []);

  const enterSelection = useCallback((id: string) => {
    setSelectionMode(true);
    setSelectedIds(new Set([id]));
  }, []);

  const exitSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleCardPress = useCallback(
    (guide: Guide) => {
      if (selectionMode) {
        toggleSelect(guide.id);
        return;
      }
      if (guide.status === 'completed') {
        navigation.navigate('GuideDetails', { guide });
      }
    },
    [selectionMode, toggleSelect, navigation],
  );

  const handleToggleFavorite = useCallback(
    (id: string) => {
      toggleFavoriteAction(id);
      // optimistic local update for snappier UI
      setGuides((prev) => prev.map((g) => (g.id === id ? { ...g, favorite: !g.favorite } : g)));
    },
    [toggleFavoriteAction],
  );

  const handleAddToGroupPicked = useCallback(
    async (targetGroupId: string) => {
      const ids = Array.from(selectedIds);
      setAddToGroupOpen(false);
      const ok = await addGuidesToGroupAction(targetGroupId, ids);
      if (ok) {
        // if current view is Created, freshly added guides should vanish from the list
        if (isVirtual) {
          setGuides((prev) => prev.filter((g) => !selectedIds.has(g.id)));
        }
        exitSelection();
      }
    },
    [selectedIds, addGuidesToGroupAction, isVirtual, exitSelection],
  );

  const handleRemoveFromGroup = useCallback(async () => {
    if (isVirtual) { return; }
    const ids = Array.from(selectedIds);
    Alert.alert(
      'Remove from Group',
      `Remove ${ids.length} ${ids.length === 1 ? 'guide' : 'guides'} from "${headerTitle}"? They'll move back to Created.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const ok = await removeGuidesFromGroupAction(groupId, ids);
            if (ok) {
              setGuides((prev) => prev.filter((g) => !selectedIds.has(g.id)));
              exitSelection();
            }
          },
        },
      ],
    );
  }, [isVirtual, selectedIds, groupId, removeGuidesFromGroupAction, headerTitle, exitSelection]);

  const handleNewGuide = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photo library');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      allowsEditing: true,
    });
    if (result.canceled || !result.assets[0]) { return; }

    try {
      const uploaded = await apiClient.uploadImage(result.assets[0].uri);
      addGuideToStore(uploaded);
      if (!isVirtual) {
        await addGuidesToGroupAction(groupId, [uploaded.id]);
        updateGuideInList({ ...uploaded, groupIds: [...(uploaded.groupIds || []), groupId] });
      }
      navigation.navigate('Processing', { guide: uploaded });
    } catch (err: any) {
      Alert.alert('Upload Failed', err?.message || 'Please try again');
    }
  }, [isVirtual, groupId, addGuideToStore, addGuidesToGroupAction, updateGuideInList, navigation]);

  const openCamera = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Required', 'Please allow camera access');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      allowsEditing: true,
    });
    if (result.canceled || !result.assets[0]) { return; }
    try {
      const uploaded = await apiClient.uploadImage(result.assets[0].uri);
      addGuideToStore(uploaded);
      if (!isVirtual) {
        await addGuidesToGroupAction(groupId, [uploaded.id]);
      }
      navigation.navigate('Processing', { guide: uploaded });
    } catch (err: any) {
      Alert.alert('Upload Failed', err?.message || 'Please try again');
    }
  }, [isVirtual, groupId, addGuideToStore, addGuidesToGroupAction, navigation]);

  const renderItem = useCallback(
    ({ item }: { item: Guide | { __tile: 'new' } }) => {
      if ('__tile' in item) {
        return <NewGuideTile width={CARD_W} onPress={handleNewGuide} />;
      }
      return (
        <GuideGridCard
          guide={item}
          width={CARD_W}
          selected={selectedIds.has(item.id)}
          selectionMode={selectionMode}
          onPress={() => handleCardPress(item)}
          onLongPress={() => enterSelection(item.id)}
          onToggleFavorite={() => handleToggleFavorite(item.id)}
        />
      );
    },
    [handleNewGuide, selectedIds, selectionMode, handleCardPress, enterSelection, handleToggleFavorite],
  );

  const data = useMemo<Array<Guide | { __tile: 'new' }>>(
    () => (selectionMode ? filtered : [{ __tile: 'new' }, ...filtered]),
    [filtered, selectionMode],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        {selectionMode ? (
          <>
            <TouchableOpacity style={styles.iconBtn} onPress={exitSelection} accessibilityLabel="Cancel selection">
              <Ionicons name="close" size={22} color={dark.text} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>
                {selectedIds.size} {selectedIds.size === 1 ? 'selected' : 'selected'}
              </Text>
            </View>
            <View style={styles.iconBtn} />
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} accessibilityLabel="Back">
              <Ionicons name="chevron-back" size={22} color={dark.text} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle} numberOfLines={1}>{headerTitle}</Text>
              <Text style={styles.headerSubtitle}>
                {total} {total === 1 ? 'ITEM' : 'ITEMS'}
              </Text>
            </View>
            <View style={styles.iconBtn} />
          </>
        )}
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchField}>
          <Ionicons name="search" size={18} color={dark.textSecondary} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search poses, tags…"
            placeholderTextColor={dark.textSecondary}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {search.length > 0 ? (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={dark.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Filter chips */}
      <View style={styles.chipsRow}>
        <Chip label="All Guides" active={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label="Favorites" active={filter === 'favorites'} onPress={() => setFilter('favorites')} />
      </View>

      {/* Grid */}
      {isLoading && guides.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={dark.primary} />
        </View>
      ) : error && guides.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => ('__tile' in item ? item.__tile : item.id)}
          renderItem={renderItem}
          numColumns={GRID_COLS}
          columnWrapperStyle={styles.column}
          contentContainerStyle={styles.list}
          removeClippedSubviews
          maxToRenderPerBatch={8}
          windowSize={5}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={load} tintColor={dark.primary} colors={[dark.primary]} />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>
              {search.trim() || filter === 'favorites' ? 'Nothing matches your filters.' : 'No guides in this group yet.'}
            </Text>
          }
        />
      )}

      {/* Selection action bar */}
      {selectionMode && selectedIds.size > 0 ? (
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setAddToGroupOpen(true)}
          >
            <Ionicons name="folder-outline" size={20} color={dark.text} />
            <Text style={styles.actionLabel}>Add to group</Text>
          </TouchableOpacity>
          {!isVirtual ? (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleRemoveFromGroup}
            >
              <Ionicons name="remove-circle-outline" size={20} color={dark.error} />
              <Text style={[styles.actionLabel, { color: dark.error }]}>Remove</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <TouchableOpacity style={styles.fab} onPress={openCamera} accessibilityLabel="Open camera">
          <Ionicons name="camera" size={26} color={dark.background} />
        </TouchableOpacity>
      )}

      <AddToGroupModal
        visible={addToGroupOpen}
        groups={groups}
        excludeGroupId={isVirtual ? undefined : groupId}
        onClose={() => setAddToGroupOpen(false)}
        onPick={handleAddToGroupPicked}
        onCreate={createGroupAction}
      />
    </SafeAreaView>
  );
};

const Chip: React.FC<{ label: string; active?: boolean; onPress?: () => void }> = ({ label, active, onPress }) => (
  <TouchableOpacity
    style={[chipStyles.chip, active && chipStyles.active]}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <Text style={[chipStyles.label, active && chipStyles.activeLabel]}>{label}</Text>
  </TouchableOpacity>
);

const chipStyles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: dark.surface,
  },
  active: {
    backgroundColor: dark.accent,
  },
  label: {
    color: dark.text,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  activeLabel: {
    color: dark.background,
  },
});

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: dark.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: dark.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: dark.textSecondary,
    fontSize: fontSize.xs,
    letterSpacing: 1,
    marginTop: 2,
  },
  searchRow: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: dark.surface,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    height: 44,
  },
  searchInput: {
    flex: 1,
    color: dark.text,
    fontSize: fontSize.md,
  },
  chipsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  list: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: spacing.xxl,
  },
  column: {
    gap: GRID_GAP,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    color: dark.error,
    marginBottom: spacing.md,
  },
  retryBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: dark.surface,
    borderRadius: borderRadius.full,
  },
  retryText: {
    color: dark.text,
    fontWeight: '600',
  },
  empty: {
    textAlign: 'center',
    color: dark.textSecondary,
    marginTop: spacing.xxl,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: dark.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.md,
    backgroundColor: dark.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: dark.border,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  actionLabel: {
    color: dark.text,
    fontWeight: '600',
  },
});
