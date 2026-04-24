import React, { useCallback, useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, fontSize, borderRadius } from '../../config/theme';
import { SemanticColors } from '../../config/theme';
import { UploadReferenceCard } from '../../components/UploadReferenceCard';
import { GroupTile, CreateGroupTile } from '../../components/GroupTile';
import { TextInputModal } from '../../components/TextInputModal';
import { EmptyState } from '../../components/EmptyState';
import { useGroupsStore } from '../../store/groupsStore';
import { useGuidesStore } from '../../store/guidesStore';
import { usePoseGuideUpload } from '../../hooks/usePoseGuideUpload';
import { useSessionRecentsStore } from '../../store/sessionRecentsStore';
import { usePendingUploadStore } from '../../store/pendingUploadStore';
import { CREATED_GROUP_ID, CREATED_GROUP_NAME, MAX_GROUP_NAME_LENGTH } from '../../types/group';
import { useTheme } from '../../theme/ThemeContext';

const { width: SCREEN_W } = Dimensions.get('window');
const RECENT_THUMB = (SCREEN_W - spacing.md * 2 - spacing.sm * 2) / 3;

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { semantic } = useTheme();
  const styles = useMemo(() => makeStyles(semantic), [semantic]);
  const groups = useGroupsStore((s) => s.groups);
  const unassignedCount = useGroupsStore((s) => s.unassignedCount);
  const isLoadingGroups = useGroupsStore((s) => s.isLoading);
  const error = useGroupsStore((s) => s.error);
  const loadGroups = useGroupsStore((s) => s.loadGroups);
  const createGroup = useGroupsStore((s) => s.createGroup);
  const deleteGroup = useGroupsStore((s) => s.deleteGroup);
  const loadGuides = useGuidesStore((state) => state.loadGuides);

  const {
    selectedImage,
    selectedStyle,
    setSelectedStyle,
    isUploading,
    pickImage,
    selectImageUri,
    clearSelection,
    uploadImage,
  } = usePoseGuideUpload();

  const recents = useSessionRecentsStore((state) => state.recents);
  const [createModalVisible, setCreateModalVisible] = useState(false);

  const pendingUri = usePendingUploadStore((s) => s.pendingUri);
  const setPendingUri = usePendingUploadStore((s) => s.setPendingUri);

  const homeFirstFocusRef = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (homeFirstFocusRef.current) {
        homeFirstFocusRef.current = false;
        loadGroups();
        loadGuides(true);
      } else {
        loadGroups({ silent: true });
      }
      if (pendingUri) {
        selectImageUri(pendingUri);
        setPendingUri(null);
      }
    }, [loadGroups, loadGuides, pendingUri, selectImageUri, setPendingUri]),
  );

  const handleRefresh = useCallback(() => {
    loadGroups();
    loadGuides(true);
  }, [loadGroups, loadGuides]);

  const openGroup = useCallback(
    (groupId: string, groupName: string) => {
      navigation.navigate('Group', { groupId, groupName });
    },
    [navigation],
  );

  const handleCreateGroup = useCallback(
    async (name: string) => {
      setCreateModalVisible(false);
      const created = await createGroup(name);
      if (created) {
        openGroup(created.id, created.name);
      }
    },
    [createGroup, openGroup],
  );

  const handleLongPressGroup = useCallback(
    (groupId: string, groupName: string) => {
      Alert.alert(groupName, undefined, [
        {
          text: 'Delete Group',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Delete Group',
              `Delete "${groupName}"? Guides inside will move back to Created.`,
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => deleteGroup(groupId) },
              ],
            );
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [deleteGroup],
  );

  const openPhotoDetail = useCallback(
    (capture: { id: string; uri: string; createdAt: number }, index: number) => {
      navigation.navigate('SavedPhotoDetails', {
        photo: { id: capture.id, uri: capture.uri, createdAt: capture.createdAt, filename: `${capture.id}.jpg` },
        allPhotos: recents.map((r) => ({ id: r.id, uri: r.uri, createdAt: r.createdAt, filename: `${r.id}.jpg` })),
        initialIndex: index,
      });
    },
    [navigation, recents],
  );

  const recentPhotosRow = useMemo(() => {
    if (recents.length === 0) {
      return null;
    }
    return (
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Photos</Text>
          <TouchableOpacity onPress={() => navigation.navigate('SavedGallery')}>
            <Text style={styles.sectionAction}>Gallery</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.recentsContent}
        >
          {recents.map((capture, index) => (
            <TouchableOpacity
              key={capture.id}
              style={styles.recentThumb}
              activeOpacity={0.8}
              onPress={() => openPhotoDetail(capture, index)}
            >
              <Image
                source={{ uri: capture.uri }}
                style={styles.recentImage}
                resizeMode="cover"
              />
              <View style={styles.recentBadge}>
                <Ionicons name="images-outline" size={12} color={semantic.text} />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }, [recents, navigation, openPhotoDetail, styles, semantic.text]);

  const groupTiles = useMemo(() => {
    const items: Array<
      | { key: string; kind: 'group'; id: string; name: string; count: number; isDefault: boolean }
      | { key: 'create'; kind: 'create' }
    > = [];

    items.push({
      key: CREATED_GROUP_ID,
      kind: 'group',
      id: CREATED_GROUP_ID,
      name: CREATED_GROUP_NAME,
      count: unassignedCount,
      isDefault: true,
    });

    for (const g of groups) {
      items.push({
        key: g.id,
        kind: 'group',
        id: g.id,
        name: g.name,
        count: g.guideCount,
        isDefault: false,
      });
    }

    items.push({ key: 'create', kind: 'create' });

    const rows: typeof items[] = [];
    for (let i = 0; i < items.length; i += 2) {
      rows.push(items.slice(i, i + 2));
    }
    return rows;
  }, [groups, unassignedCount]);

  const showEmptyGroupsHint = !isLoadingGroups && groups.length === 0 && unassignedCount === 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isLoadingGroups}
            onRefresh={handleRefresh}
            tintColor={semantic.primary}
            colors={[semantic.primary]}
          />
        }
      >
        <View style={styles.topBar}>
          <Text style={styles.appTitle}>DoThePose</Text>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => navigation.navigate('Settings')}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <Ionicons name="settings-outline" size={22} color={semantic.text} />
          </TouchableOpacity>
        </View>

        <UploadReferenceCard
          selectedImage={selectedImage}
          selectedStyle={selectedStyle}
          onStyleChange={setSelectedStyle}
          isUploading={isUploading}
          onPickGallery={() => pickImage(false)}
          onPickCamera={() => pickImage(true)}
          onClearSelection={clearSelection}
          onUpload={uploadImage}
        />

        {recentPhotosRow}

        <View style={styles.groupsHeader}>
          <Text style={styles.sectionTitle}>Your Groups</Text>
          <TouchableOpacity
            style={styles.headerAction}
            onPress={() => setCreateModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Create new group"
          >
            <Ionicons name="add" size={22} color={semantic.accent} />
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {isLoadingGroups && groups.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={semantic.primary} />
          </View>
        ) : showEmptyGroupsHint ? (
          <EmptyState
            icon="folder-outline"
            title="No guides yet"
            subtitle="Upload a reference above to create your first pose guide — it'll land in Created."
          />
        ) : (
          <View style={styles.grid}>
            {groupTiles.map((row, rowIdx) => (
              <View key={`row-${rowIdx}`} style={styles.gridRow}>
                {row.map((item) =>
                  item.kind === 'create' ? (
                    <CreateGroupTile key={item.key} onPress={() => setCreateModalVisible(true)} />
                  ) : (
                    <GroupTile
                      key={item.key}
                      name={item.name}
                      guideCount={item.count}
                      isDefault={item.isDefault}
                      onPress={() => openGroup(item.id, item.name)}
                      onLongPress={item.isDefault ? undefined : () => handleLongPressGroup(item.id, item.name)}
                    />
                  ),
                )}
                {row.length === 1 ? <View style={styles.gridSpacer} /> : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <TextInputModal
        visible={createModalVisible}
        title="New Group"
        placeholder="Group name"
        confirmLabel="Create"
        maxLength={MAX_GROUP_NAME_LENGTH}
        onCancel={() => setCreateModalVisible(false)}
        onSubmit={handleCreateGroup}
      />
    </SafeAreaView>
  );
};

function makeStyles(s: SemanticColors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: s.background,
    },
    content: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xl,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.lg,
    },
    appTitle: {
      fontSize: fontSize.xxl,
      fontWeight: '700',
      color: s.text,
    },
    settingsButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: s.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionBlock: {
      marginBottom: spacing.lg,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    sectionTitle: {
      fontSize: fontSize.lg,
      fontWeight: '700',
      color: s.text,
    },
    sectionAction: {
      fontSize: fontSize.sm,
      color: s.textSecondary,
      fontWeight: '500',
    },
    recentsContent: {
      gap: spacing.sm,
    },
    recentThumb: {
      width: RECENT_THUMB,
      height: RECENT_THUMB,
      borderRadius: borderRadius.md,
      overflow: 'hidden',
      backgroundColor: s.surfaceMuted,
    },
    recentImage: {
      width: '100%',
      height: '100%',
    },
    recentBadge: {
      position: 'absolute',
      bottom: spacing.xs,
      right: spacing.xs,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    groupsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.md,
      marginBottom: spacing.md,
    },
    headerAction: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: s.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    errorText: {
      color: s.error,
      fontSize: fontSize.sm,
      marginBottom: spacing.sm,
    },
    center: {
      paddingVertical: spacing.xxl,
      alignItems: 'center',
      justifyContent: 'center',
    },
    grid: {
      gap: spacing.md,
    },
    gridRow: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    gridSpacer: {
      flex: 1,
    },
  });
}
