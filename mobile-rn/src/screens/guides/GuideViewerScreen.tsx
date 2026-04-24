import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { colors, spacing, borderRadius, fontSize } from '../../config/theme';
import { Guide } from '../../types/guide';
import { getFullImageUrl } from '../../config/api';
import { useGuidesStore } from '../../store/guidesStore';
import { useGroupsStore } from '../../store/groupsStore';
import { apiClient } from '../../api/client';
import { AddToGroupModal } from '../../components/AddToGroupModal';

type RouteParams = {
  GuideViewer: { guide: Guide };
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const GuideViewerScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'GuideViewer'>>();
  const { guide: initialGuide } = route.params;
  const insets = useSafeAreaInsets();

  const [guide, setGuide] = useState<Guide>(initialGuide);
  const [opacity, setOpacity] = useState(Number(guide.settings.opacity) || 0.4);
  const [showControls, setShowControls] = useState(true);
  const [addToGroupOpen, setAddToGroupOpen] = useState(false);

  const deleteGuide = useGuidesStore((s) => s.deleteGuide);
  const updateGuideInList = useGuidesStore((s) => s.updateGuideInList);
  const groups = useGroupsStore((s) => s.groups);
  const loadGroups = useGroupsStore((s) => s.loadGroups);
  const createGroupAction = useGroupsStore((s) => s.createGroup);
  const addGuidesToGroupAction = useGroupsStore((s) => s.addGuidesToGroup);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const guideImageUrl = getFullImageUrl(guide.guideImageUrl);

  const handleToggleFavorite = async () => {
    try {
      const updated = await apiClient.updateGuide(guide.id, {
        favorite: !guide.favorite,
      });
      setGuide(updated);
      updateGuideInList(updated);
    } catch (error) {
      Alert.alert('Error', 'Failed to update favorite');
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Guide', 'Are you sure you want to delete this guide?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const success = await deleteGuide(guide.id);
          if (success) {
            navigation.goBack();
          } else {
            Alert.alert('Error', 'Failed to delete guide');
          }
        },
      },
    ]);
  };

  const handleUseWithCamera = () => {
    navigation.navigate('CameraOverlay', { guide });
  };

  const handleAddToGroupPicked = async (groupId: string) => {
    setAddToGroupOpen(false);
    const ok = await addGuidesToGroupAction(groupId, [guide.id]);
    if (ok) {
      const nextIds = Array.from(new Set([...(guide.groupIds || []), groupId]));
      const updated = { ...guide, groupIds: nextIds };
      setGuide(updated);
      updateGuideInList(updated);
      const target = groups.find((g) => g.id === groupId);
      Alert.alert('Added', target ? `Added to "${target.name}".` : 'Added to group.');
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.imageContainer}
        activeOpacity={1}
        onPress={() => setShowControls(!showControls)}
      >
        {guideImageUrl ? (
          <Image
            source={{ uri: guideImageUrl }}
            style={[styles.guideImage, { opacity }]}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="image-outline" size={64} color={colors.textLight} />
            <Text style={styles.placeholderText}>Guide not available</Text>
          </View>
        )}
      </TouchableOpacity>

      {showControls && (
        <>
          <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>Pose Guide</Text>

            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={handleToggleFavorite}
              >
                <Ionicons
                  name={Boolean(guide.favorite) ? 'heart' : 'heart-outline'}
                  size={24}
                  color={Boolean(guide.favorite) ? colors.error : '#fff'}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.headerButton}
                onPress={handleUseWithCamera}
              >
                <Ionicons name="camera" size={24} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => setAddToGroupOpen(true)}
                accessibilityLabel="Add to group"
              >
                <Ionicons name="folder-outline" size={24} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.headerButton} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          <SafeAreaView style={styles.controls} edges={['bottom']}>
            <View style={styles.opacityControl}>
              <Ionicons name="contrast-outline" size={20} color="#fff" />
              <Slider
                style={styles.slider}
                minimumValue={0.1}
                maximumValue={1}
                value={opacity}
                onValueChange={setOpacity}
                minimumTrackTintColor="#fff"
                maximumTrackTintColor="rgba(255,255,255,0.3)"
                thumbTintColor="#fff"
              />
              <Text style={styles.opacityValue}>{Math.round(opacity * 100)}%</Text>
            </View>

            <View style={styles.layerInfo}>
              {Boolean(guide.layers?.pose) && (
                <View style={styles.layerBadge}>
                  <Ionicons name="body-outline" size={14} color="#fff" />
                  <Text style={styles.layerText}>Pose</Text>
                </View>
              )}
              {Boolean(guide.layers?.horizon) && (
                <View style={styles.layerBadge}>
                  <Ionicons name="remove-outline" size={14} color="#fff" />
                  <Text style={styles.layerText}>Horizon</Text>
                </View>
              )}
              {Boolean(guide.layers?.sun) && (
                <View style={styles.layerBadge}>
                  <Ionicons name="sunny-outline" size={14} color="#fff" />
                  <Text style={styles.layerText}>Sun</Text>
                </View>
              )}
              {Boolean(guide.layers?.composition) && (
                <View style={styles.layerBadge}>
                  <Ionicons name="grid-outline" size={14} color="#fff" />
                  <Text style={styles.layerText}>Composition</Text>
                </View>
              )}
            </View>
          </SafeAreaView>
        </>
      )}

      <AddToGroupModal
        visible={addToGroupOpen}
        groups={groups}
        onClose={() => setAddToGroupOpen(false)}
        onPick={handleAddToGroupPicked}
        onCreate={createGroupAction}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  placeholder: {
    alignItems: 'center',
  },
  placeholderText: {
    color: colors.textLight,
    marginTop: spacing.md,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  headerButton: {
    padding: spacing.sm,
  },
  headerTitle: {
    color: '#fff',
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  opacityControl: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slider: {
    flex: 1,
    marginHorizontal: spacing.md,
  },
  opacityValue: {
    color: '#fff',
    fontWeight: '600',
    width: 45,
    textAlign: 'right',
  },
  layerInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  layerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  layerText: {
    color: '#fff',
    fontSize: fontSize.xs,
  },
});
