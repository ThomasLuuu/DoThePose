import React, { useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  ListRenderItem,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { dark, spacing, fontSize, borderRadius } from '../../config/theme';
import { UploadReferenceCard } from '../../components/UploadReferenceCard';
import { GuideListRow } from '../../components/GuideListRow';
import { EmptyState } from '../../components/EmptyState';
import { useGuidesStore } from '../../store/guidesStore';
import { usePoseGuideUpload } from '../../hooks/usePoseGuideUpload';
import { useSessionRecentsStore } from '../../store/sessionRecentsStore';
import { Guide } from '../../types/guide';

const { width: SCREEN_W } = Dimensions.get('window');
const RECENT_THUMB = (SCREEN_W - spacing.md * 2 - spacing.sm * 2) / 3;

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const {
    guides,
    isLoading,
    error,
    hasMore,
    loadGuides,
    toggleFavorite,
    deleteGuide,
  } = useGuidesStore();

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

  useEffect(() => {
    loadGuides(true);
  }, [loadGuides]);

  const handleRefresh = useCallback(() => {
    loadGuides(true);
  }, [loadGuides]);

  const handleLoadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      loadGuides(false);
    }
  }, [isLoading, hasMore, loadGuides]);

  const handleGuidePress = useCallback(
    (guide: Guide) => {
      if (guide.status === 'completed') {
        navigation.navigate('GuideViewer', { guide });
      }
    },
    [navigation]
  );

  const handleGuideLongPress = useCallback(
    (guide: Guide) => {
      Alert.alert('Guide Options', undefined, [
        {
          text: guide.favorite ? 'Remove from Favorites' : 'Add to Favorites',
          onPress: () => toggleFavorite(guide.id),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Delete Guide',
              'Are you sure you want to delete this guide?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => deleteGuide(guide.id),
                },
              ]
            );
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [toggleFavorite, deleteGuide]
  );

  const renderItem: ListRenderItem<Guide> = useCallback(
    ({ item }) => (
      <GuideListRow
        guide={item}
        onPress={() => handleGuidePress(item)}
        onLongPress={() => handleGuideLongPress(item)}
      />
    ),
    [handleGuidePress, handleGuideLongPress]
  );

  const recentPhotosRow = useMemo(() => {
    if (recents.length === 0) {
      return null;
    }
    return (
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Photos</Text>
          <TouchableOpacity onPress={() => pickImage(false)}>
            <Text style={styles.sectionAction}>Gallery</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.recentsContent}
        >
          {recents.map((capture) => (
            <TouchableOpacity
              key={capture.id}
              style={styles.recentThumb}
              activeOpacity={0.8}
              onPress={() => selectImageUri(capture.uri)}
            >
              <Image
                source={{ uri: capture.uri }}
                style={styles.recentImage}
                resizeMode="cover"
              />
              <View style={styles.recentBadge}>
                <Ionicons name="images-outline" size={12} color={dark.text} />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }, [recents, pickImage, selectImageUri]);

  const listHeader = useMemo(
    () => (
      <View style={styles.headerBlock}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Text style={styles.appTitle}>DoThePose</Text>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => navigation.navigate('Settings')}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <Ionicons name="settings-outline" size={22} color={dark.text} />
          </TouchableOpacity>
        </View>

        {/* Upload reference card */}
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

        {/* Recent Photos strip (only shown when session captures exist) */}
        {recentPhotosRow}

        {/* Saved Guides section header */}
        <Text style={styles.sectionTitle}>Saved Guides</Text>
      </View>
    ),
    [
      navigation,
      selectedImage,
      selectedStyle,
      setSelectedStyle,
      isUploading,
      pickImage,
      clearSelection,
      uploadImage,
      recentPhotosRow,
    ]
  );

  const listEmpty = useMemo(() => {
    if (isLoading && guides.length === 0) {
      return (
        <View style={styles.emptyCenter}>
          <ActivityIndicator size="large" color={dark.primary} />
        </View>
      );
    }
    if (error && guides.length === 0) {
      return (
        <EmptyState
          variant="dark"
          icon="alert-circle-outline"
          title="Failed to load guides"
          subtitle={error}
        />
      );
    }
    return (
      <EmptyState
        variant="dark"
        icon="images-outline"
        title="No saved guides"
        subtitle="Upload a reference above to create your first pose guide"
      />
    );
  }, [isLoading, guides.length, error]);

  const listFooter = useCallback(() => {
    if (!isLoading || guides.length === 0) {
      return null;
    }
    return (
      <View style={styles.footer}>
        <ActivityIndicator color={dark.primary} />
      </View>
    );
  }, [isLoading, guides.length]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={guides}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={listFooter}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading && guides.length > 0}
            onRefresh={handleRefresh}
            tintColor={dark.primary}
            colors={[dark.primary]}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: dark.background,
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  headerBlock: {
    paddingTop: spacing.sm,
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
    color: dark.text,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: dark.surface,
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
    color: dark.text,
    marginBottom: spacing.md,
  },
  sectionAction: {
    fontSize: fontSize.sm,
    color: dark.textSecondary,
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
    backgroundColor: dark.surfaceMuted,
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
  emptyCenter: {
    flex: 1,
    minHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  footer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
});
