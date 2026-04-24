import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { spacing, borderRadius, fontSize } from '../../config/theme';
import { SemanticColors } from '../../config/theme';
import { listSavedPhotos, SavedPhoto } from '../../utils/savedPhotos';
import { useTheme } from '../../theme/ThemeContext';

const { width: SCREEN_W } = Dimensions.get('window');
const COLS = 3;
const GAP = 2;
const THUMB = (SCREEN_W - GAP * (COLS + 1)) / COLS;

export const SavedGalleryScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { semantic } = useTheme();
  const styles = useMemo(() => makeStyles(semantic), [semantic]);
  const [photos, setPhotos] = useState<SavedPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    const result = await listSavedPhotos({ forceRefresh: refresh });
    setPhotos(result);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openPhoto = useCallback(
    (photo: SavedPhoto, index: number) => {
      navigation.navigate('SavedPhotoDetails', { photo, allPhotos: photos, initialIndex: index });
    },
    [navigation, photos],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: SavedPhoto; index: number }) => (
      <TouchableOpacity
        style={styles.thumb}
        onPress={() => openPhoto(item, index)}
        activeOpacity={0.85}
      >
        <Image source={{ uri: item.uri }} style={styles.thumbImage} resizeMode="cover" />
      </TouchableOpacity>
    ),
    [openPhoto, styles],
  );

  const keyExtractor = useCallback((item: SavedPhoto) => item.id, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={[styles.header, { paddingTop: insets.top > 0 ? 0 : spacing.sm }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color={semantic.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Gallery</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={semantic.accent} size="large" />
        </View>
      ) : photos.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="images-outline" size={56} color={semantic.textSecondary} />
          <Text style={styles.emptyTitle}>No saved photos yet</Text>
          <Text style={styles.emptySubtitle}>
            Photos you save from camera sessions will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={photos}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          numColumns={COLS}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={semantic.accent}
            />
          }
        />
      )}
    </SafeAreaView>
  );
};

function makeStyles(s: SemanticColors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: s.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: s.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      color: s.text,
      fontSize: fontSize.lg,
      fontWeight: '700',
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
      gap: spacing.sm,
    },
    emptyTitle: {
      color: s.text,
      fontSize: fontSize.lg,
      fontWeight: '700',
      textAlign: 'center',
      marginTop: spacing.md,
    },
    emptySubtitle: {
      color: s.textSecondary,
      fontSize: fontSize.sm,
      textAlign: 'center',
    },
    grid: {
      paddingHorizontal: GAP,
      paddingBottom: spacing.xl,
    },
    row: {
      marginBottom: GAP,
    },
    thumb: {
      width: THUMB,
      height: THUMB,
      marginHorizontal: GAP / 2,
      backgroundColor: s.surface,
      borderRadius: borderRadius.sm,
      overflow: 'hidden',
    },
    thumbImage: {
      width: '100%',
      height: '100%',
    },
  });
}
