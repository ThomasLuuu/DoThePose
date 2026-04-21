import React, { useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing } from '../../config/theme';
import { GuideCard } from '../../components/GuideCard';
import { EmptyState } from '../../components/EmptyState';
import { useGuidesStore } from '../../store/guidesStore';
import { Guide } from '../../types/guide';

export const SavedGuidesScreen: React.FC = () => {
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

  useEffect(() => {
    loadGuides(true);
  }, []);

  const handleRefresh = useCallback(() => {
    loadGuides(true);
  }, [loadGuides]);

  const handleLoadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      loadGuides(false);
    }
  }, [isLoading, hasMore, loadGuides]);

  const handleGuidePress = (guide: Guide) => {
    if (guide.status === 'completed') {
      navigation.navigate('GuideViewer', { guide });
    }
  };

  const handleGuideLongPress = (guide: Guide) => {
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
  };

  const renderItem = ({ item }: { item: Guide }) => (
    <View style={styles.cardWrapper}>
      <GuideCard
        guide={item}
        onPress={() => handleGuidePress(item)}
        onLongPress={() => handleGuideLongPress(item)}
      />
    </View>
  );

  const renderFooter = () => {
    if (!isLoading || guides.length === 0) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  };

  if (isLoading && guides.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error && guides.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <EmptyState
          icon="alert-circle-outline"
          title="Failed to load guides"
          subtitle={error}
        />
      </SafeAreaView>
    );
  }

  if (guides.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <EmptyState
          icon="images-outline"
          title="No saved guides"
          subtitle="Create a pose guide from the Create tab to see it here"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={guides}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isLoading && guides.length > 0}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: spacing.sm,
  },
  cardWrapper: {
    flex: 0.5,
  },
  footer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
});
