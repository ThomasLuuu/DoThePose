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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { dark, spacing, fontSize } from '../../config/theme';
import { UploadReferenceCard } from '../../components/UploadReferenceCard';
import { GuideListRow } from '../../components/GuideListRow';
import { EmptyState } from '../../components/EmptyState';
import { useGuidesStore } from '../../store/guidesStore';
import { usePoseGuideUpload } from '../../hooks/usePoseGuideUpload';
import { Guide } from '../../types/guide';

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
    clearSelection,
    uploadImage,
  } = usePoseGuideUpload();

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

  const listHeader = useMemo(
    () => (
      <View style={styles.headerBlock}>
        <View style={styles.topBar}>
          <Text style={styles.appTitle}>PoseGuide</Text>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => navigation.navigate('Settings')}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <Ionicons name="settings-outline" size={22} color={dark.text} />
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

        {/* Future: Sample Poses horizontal carousel (assets or API) */}
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
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: dark.text,
    marginBottom: spacing.md,
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
