import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Share,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { spacing, borderRadius, fontSize } from '../../config/theme';
import { SemanticColors } from '../../config/theme';
import { SavedPhoto, deleteSavedPhoto } from '../../utils/savedPhotos';
import { DEFAULT_SETTINGS } from '../../types/guide';
import { usePendingUploadStore } from '../../store/pendingUploadStore';
import { useTheme } from '../../theme/ThemeContext';

type RouteParams = {
  SavedPhotoDetails: {
    photo: SavedPhoto;
    allPhotos?: SavedPhoto[];
    initialIndex?: number;
  };
};

function formatDate(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const isToday = d.toDateString() === today.toDateString();
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  if (isToday) { return `Today, ${timeStr}`; }
  if (isYesterday) { return `Yesterday, ${timeStr}`; }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + `, ${timeStr}`;
}

function deriveName(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '');
  const casualPoses = ['CASUAL POSE', 'PORTRAIT', 'LIFESTYLE', 'OUTDOOR', 'URBAN'];
  const idx = base.charCodeAt(0) % casualPoses.length;
  return `${casualPoses[idx]} ${String(base.slice(-2)).replace(/[^0-9]/g, '') || '01'}`;
}

export const SavedPhotoDetailsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'SavedPhotoDetails'>>();
  const { photo: initialPhoto } = route.params;
  const insets = useSafeAreaInsets();
  const { semantic } = useTheme();
  const styles = useMemo(() => makeStyles(semantic), [semantic]);
  const actionSt = useMemo(() => makeActionStyles(semantic), [semantic]);
  const detailSt = useMemo(() => makeDetailStyles(semantic), [semantic]);

  const [photo] = useState<SavedPhoto>(initialPhoto);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [favoriteVisible, setFavoriteVisible] = useState(false);

  const setPendingUri = usePendingUploadStore((s) => s.setPendingUri);

  const poseName = deriveName(photo.filename);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({ url: photo.uri });
    } catch (error: any) {
      if (error.message !== 'The user did not share') {
        Alert.alert('Share failed', 'Unable to share this photo.');
      }
    }
  }, [photo.uri]);

  const handleEdit = useCallback(() => {
    navigation.navigate('CropRotate', {
      sourceUri: photo.uri,
      guideId: photo.id,
      guide: {
        id: photo.id,
        name: poseName,
        sourceImageUrl: photo.uri,
        guideImageUrl: photo.uri,
        thumbnailUrl: photo.uri,
        status: 'completed',
        favorite: false,
        createdAt: new Date(photo.createdAt).toISOString(),
        updatedAt: new Date(photo.createdAt).toISOString(),
        settings: DEFAULT_SETTINGS,
        layers: { pose: false, horizon: false, sun: false, composition: false },
        tags: [],
        groupIds: [],
      },
    });
  }, [navigation, photo, poseName]);

  const handleExtract = useCallback(() => {
    setPendingUri(photo.uri);
    navigation.navigate('Main');
  }, [navigation, photo.uri, setPendingUri]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete Photo',
      'This will permanently delete the photo from this app.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const ok = await deleteSavedPhoto(photo.uri);
            if (ok) {
              navigation.goBack();
            } else {
              Alert.alert('Error', 'Could not delete this photo. Please try again.');
            }
          },
        },
      ],
    );
  }, [navigation, photo.uri]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={semantic.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerDate}>{formatDate(photo.createdAt)}</Text>
          <Text style={styles.headerName}>{poseName}</Text>
        </View>
        <TouchableOpacity
          style={styles.iconBtn}
          hitSlop={8}
          onPress={() => setFavoriteVisible(true)}
        >
          <Ionicons name="ellipsis-vertical" size={22} color={semantic.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.imageWrapper}>
        <Image source={{ uri: photo.uri }} style={styles.image} resizeMode="cover" />
        <TouchableOpacity style={styles.visibilityBadge} hitSlop={8}>
          <Ionicons name="eye-off-outline" size={18} color={semantic.text} />
        </TouchableOpacity>
      </View>

      <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
        <ActionItem styles={actionSt} icon="arrow-up-outline" label="SHARE" onPress={handleShare} semantic={semantic} />
        <ActionItem styles={actionSt} icon="options-outline" label="EDIT" onPress={handleEdit} semantic={semantic} />
        <ActionItem styles={actionSt} icon="scan-outline" label="EXTRACT" onPress={handleExtract} accent semantic={semantic} />
        <ActionItem styles={actionSt} icon="information-circle-outline" label="DETAILS" onPress={() => setDetailsVisible(true)} semantic={semantic} />
        <ActionItem styles={actionSt} icon="trash-outline" label="DELETE" onPress={handleDelete} destructive semantic={semantic} />
      </SafeAreaView>

      <Modal visible={detailsVisible} transparent animationType="slide" onRequestClose={() => setDetailsVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDetailsVisible(false)}>
          <View style={[styles.detailsSheet, { paddingBottom: insets.bottom + spacing.md }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Photo Details</Text>
            <DetailRow styles={detailSt} label="Filename" value={photo.filename} />
            <DetailRow styles={detailSt} label="Saved" value={formatDate(photo.createdAt)} />
            <DetailRow styles={detailSt} label="Location" value="App storage" />
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={favoriteVisible} transparent animationType="fade" onRequestClose={() => setFavoriteVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setFavoriteVisible(false)}>
          <View style={[styles.menuSheet, { paddingBottom: insets.bottom + spacing.md }]}>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setFavoriteVisible(false); handleShare(); }}>
              <Ionicons name="share-outline" size={20} color={semantic.text} />
              <Text style={styles.menuLabel}>Share</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} onPress={() => { setFavoriteVisible(false); handleDelete(); }}>
              <Ionicons name="trash-outline" size={20} color={semantic.error} />
              <Text style={[styles.menuLabel, { color: semantic.error }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

interface ActionItemProps {
  styles: ReturnType<typeof makeActionStyles>;
  semantic: SemanticColors;
  icon: string;
  label: string;
  onPress: () => void;
  accent?: boolean;
  destructive?: boolean;
}

const ActionItem: React.FC<ActionItemProps> = ({ styles, semantic, icon, label, onPress, accent, destructive }) => {
  const iconColor = destructive ? semantic.error : semantic.text;
  const labelColor = destructive ? semantic.error : semantic.text;

  return (
    <TouchableOpacity style={styles.item} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.circle, accent && styles.accentCircle]}>
        <Ionicons name={icon as any} size={22} color={accent ? semantic.background : iconColor} />
      </View>
      <Text style={[styles.label, { color: labelColor }, accent && styles.accentLabel]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

interface DetailRowProps {
  styles: ReturnType<typeof makeDetailStyles>;
  label: string;
  value: string;
}

const DetailRow: React.FC<DetailRowProps> = ({ styles, label, value }) => (
  <View style={styles.row}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value}>{value}</Text>
  </View>
);

function makeStyles(s: SemanticColors) {
  return StyleSheet.create({
    container: {
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
    headerCenter: {
      alignItems: 'center',
    },
    headerDate: {
      color: s.text,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    headerName: {
      color: s.textSecondary,
      fontSize: fontSize.xs,
      letterSpacing: 0.5,
      marginTop: 2,
    },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    imageWrapper: {
      flex: 1,
      position: 'relative',
    },
    image: {
      width: '100%',
      height: '100%',
    },
    visibilityBadge: {
      position: 'absolute',
      top: spacing.md,
      right: spacing.md,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    bottomBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-around',
      backgroundColor: s.background,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: s.border,
      paddingTop: spacing.md,
      paddingHorizontal: spacing.sm,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    detailsSheet: {
      backgroundColor: s.surface,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
    },
    sheetHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: s.border,
      alignSelf: 'center',
      marginBottom: spacing.md,
    },
    sheetTitle: {
      color: s.text,
      fontSize: fontSize.lg,
      fontWeight: '700',
      marginBottom: spacing.lg,
    },
    menuSheet: {
      position: 'absolute',
      bottom: 0,
      left: spacing.md,
      right: spacing.md,
      backgroundColor: s.surface,
      borderRadius: borderRadius.xl,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md + 2,
    },
    menuLabel: {
      color: s.text,
      fontSize: fontSize.md,
    },
    menuDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: s.border,
      marginHorizontal: spacing.lg,
    },
  });
}

function makeActionStyles(s: SemanticColors) {
  return StyleSheet.create({
    item: {
      alignItems: 'center',
      gap: spacing.xs,
      paddingBottom: spacing.sm,
      minWidth: 56,
    },
    circle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: s.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    accentCircle: {
      backgroundColor: s.accent,
      borderWidth: 2,
      borderColor: s.accent,
    },
    label: {
      color: s.text,
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 0.4,
    },
    accentLabel: {
      color: s.accent,
    },
  });
}

function makeDetailStyles(s: SemanticColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.sm + 2,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: s.border,
    },
    label: {
      color: s.textSecondary,
      fontSize: fontSize.sm,
    },
    value: {
      color: s.text,
      fontSize: fontSize.sm,
      fontWeight: '500',
      maxWidth: '60%',
      textAlign: 'right',
    },
  });
}
