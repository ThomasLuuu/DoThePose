import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Dimensions,
  TextStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { dark, spacing, borderRadius, fontSize } from '../../config/theme';
import { Guide } from '../../types/guide';
import { getFullImageUrl } from '../../config/api';
import { useGuidesStore } from '../../store/guidesStore';
import { useGroupsStore } from '../../store/groupsStore';
import { apiClient } from '../../api/client';
import { AddToGroupModal } from '../../components/AddToGroupModal';

type RouteParams = {
  GuideDetails: { guide: Guide };
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_HEIGHT = SCREEN_WIDTH * 1.1;

function formatCreatedDate(isoString: string): string {
  const date = new Date(isoString);
  const month = date.toLocaleString('en-US', { month: 'short' });
  const day = date.getDate();
  return `Created ${month} ${day}`;
}

export const GuideDetailsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'GuideDetails'>>();
  const { guide: initialGuide } = route.params;
  const insets = useSafeAreaInsets();

  const [guide, setGuide] = useState<Guide>(initialGuide);
  const [addToGroupOpen, setAddToGroupOpen] = useState(false);

  const { deleteGuide, updateGuideInList } = useGuidesStore();
  const groups = useGroupsStore((s) => s.groups);
  const loadGroups = useGroupsStore((s) => s.loadGroups);
  const createGroupAction = useGroupsStore((s) => s.createGroup);
  const addGuidesToGroupAction = useGroupsStore((s) => s.addGuidesToGroup);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const guideImageUrl = getFullImageUrl(guide.guideImageUrl || guide.thumbnailUrl);

  const handleToggleFavorite = async () => {
    try {
      const updated = await apiClient.updateGuide(guide.id, {
        favorite: !guide.favorite,
      });
      setGuide(updated);
      updateGuideInList(updated);
    } catch {
      Alert.alert('Error', 'Failed to update favorite');
    }
  };

  const handleEdit = () => {
    navigation.navigate('EditGuide', { guide });
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

  const activeLayers = [
    guide.layers?.pose && 'SKELETON',
    guide.layers?.horizon && 'HORIZON',
    guide.layers?.sun && 'SUN',
    guide.layers?.composition && 'COMPOSITION',
  ].filter(Boolean) as string[];

  const categoryLabel = guide.tags?.length > 0 ? guide.tags[0] : null;
  const dateLabel = formatCreatedDate(guide.createdAt);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Back"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color={dark.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Guide Details</Text>
        <TouchableOpacity
          style={styles.iconBtn}
          accessibilityLabel="Settings"
          hitSlop={8}
          onPress={() => Alert.alert('Settings', 'Guide settings will be available soon.')}
        >
          <Ionicons name="settings-outline" size={22} color={dark.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Guide Image Card */}
        <View style={styles.imageCard}>
          {guideImageUrl ? (
            <Image
              source={{ uri: guideImageUrl }}
              style={styles.guideImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.guideImage, styles.imagePlaceholder]}>
              <Ionicons name="image-outline" size={48} color={dark.textSecondary} />
            </View>
          )}
          {activeLayers.length > 0 && (
            <View style={styles.badgeRow}>
              {activeLayers.map((label) => (
                <View key={label} style={styles.badge}>
                  <Text style={styles.badgeText}>{label}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Title & Meta */}
        <View style={styles.metaSection}>
          <Text style={styles.guideName}>{guide.name || 'Untitled Guide'}</Text>
          <Text style={styles.guideMeta}>
            {dateLabel}
            {categoryLabel ? ` · ${categoryLabel}` : ''}
          </Text>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Action buttons */}
        <View style={styles.actionsRow}>
          <ActionButton
            icon={
              <Ionicons
                name={guide.favorite ? 'heart' : 'heart-outline'}
                size={24}
                color={dark.text}
              />
            }
            label="FAVORITE"
            onPress={handleToggleFavorite}
          />
          <ActionButton
            icon={<Ionicons name="albums-outline" size={24} color={dark.text} />}
            label="MOVE"
            onPress={() => setAddToGroupOpen(true)}
          />
          <ActionButton
            icon={<Ionicons name="pencil-outline" size={24} color={dark.text} />}
            label="EDIT"
            onPress={handleEdit}
          />
          <ActionButton
            icon={<Ionicons name="trash-outline" size={24} color={dark.error} />}
            label="DELETE"
            labelStyle={styles.deleteLabel}
            onPress={handleDelete}
          />
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={handleUseWithCamera}
          activeOpacity={0.85}
        >
          <Ionicons name="camera-outline" size={22} color={dark.background} />
          <Text style={styles.ctaText}>Use This Guide</Text>
        </TouchableOpacity>
      </SafeAreaView>

      <AddToGroupModal
        visible={addToGroupOpen}
        groups={groups}
        onClose={() => setAddToGroupOpen(false)}
        onPick={handleAddToGroupPicked}
        onCreate={createGroupAction}
      />
    </SafeAreaView>
  );
};

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  labelStyle?: TextStyle;
}

const ActionButton: React.FC<ActionButtonProps> = ({ icon, label, onPress, labelStyle }) => (
  <TouchableOpacity style={actionStyles.btn} onPress={onPress} activeOpacity={0.7}>
    <View style={actionStyles.circle}>{icon}</View>
    <Text style={[actionStyles.label, labelStyle]}>{label}</Text>
  </TouchableOpacity>
);

const actionStyles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  circle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: dark.text,
    fontSize: fontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: dark.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    zIndex: 10,
    elevation: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: dark.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  imageCard: {
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    height: IMAGE_HEIGHT,
  },
  guideImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    backgroundColor: dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRow: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  badge: {
    backgroundColor: dark.accent,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    color: dark.background,
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  metaSection: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    gap: spacing.xs,
  },
  guideName: {
    color: dark.text,
    fontSize: fontSize.xxxl,
    fontWeight: '700',
  },
  guideMeta: {
    color: dark.textSecondary,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: dark.border,
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  deleteLabel: {
    color: dark.error,
  },
  bottomBar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: dark.border,
    backgroundColor: dark.background,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: dark.accent,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md + 2,
    gap: spacing.sm,
  },
  ctaText: {
    color: dark.background,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
});
