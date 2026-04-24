import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { spacing, borderRadius, fontSize } from '../../config/theme';
import { SemanticColors } from '../../config/theme';
import { Guide } from '../../types/guide';
import { getFullImageUrl } from '../../config/api';
import { apiClient } from '../../api/client';
import { useGuidesStore } from '../../store/guidesStore';
import { CleanBgModal } from './edit/CleanBgModal';
import { useTheme } from '../../theme/ThemeContext';

type RouteParams = {
  EditGuide: {
    guide: Guide;
    appliedEditUri?: string;
  };
};

const { width: SCREEN_W } = Dimensions.get('window');

export const EditGuideScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'EditGuide'>>();
  const insets = useSafeAreaInsets();
  const { guide: initialGuide } = route.params;
  const updateGuideInList = useGuidesStore((s) => s.updateGuideInList);
  const { semantic } = useTheme();
  const styles = useMemo(() => makeStyles(semantic), [semantic]);

  const [guide, setGuide] = useState<Guide>(initialGuide);
  const [workingUri, setWorkingUri] = useState<string | null>(null);
  const [toolBusy, setToolBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState<string>(guide.name ?? '');
  const nameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onNameChange = (text: string) => {
    setName(text);
    if (nameDebounceRef.current) { clearTimeout(nameDebounceRef.current); }
    nameDebounceRef.current = setTimeout(async () => {
      try {
        const updated = await apiClient.updateGuide(guide.id, { name: text });
        setGuide(updated);
        updateGuideInList(updated);
      } catch {
        // best-effort
      }
    }, 500);
  };

  useEffect(() => {
    return () => {
      if (nameDebounceRef.current) { clearTimeout(nameDebounceRef.current); }
    };
  }, []);

  useEffect(() => {
    const uri = route.params.appliedEditUri;
    if (uri) {
      setWorkingUri(uri);
      navigation.setParams({ appliedEditUri: undefined });
    }
  }, [route.params.appliedEditUri, navigation]);

  const outlineRemote = `${getFullImageUrl(guide.guideImageUrl)}?cb=${encodeURIComponent(String(guide.updatedAt ?? ''))}`;
  const displayUri = workingUri ?? outlineRemote;
  const dirty = workingUri !== null || guide.updatedAt !== initialGuide.updatedAt;

  const ensureLocalUri = useCallback(
    async (uri: string, existing: string | null): Promise<string> => {
      if (existing && existing.startsWith('file')) { return existing; }
      if (uri.startsWith('file')) { return uri; }
      const base = FileSystem.cacheDirectory;
      if (!base) { throw new Error('Cache directory is not available'); }
      const target = `${base}edit_work_${guide.id}_${Date.now()}.png`;
      await FileSystem.downloadAsync(uri, target);
      return target;
    },
    [guide.id],
  );

  const [cleanBgVisible, setCleanBgVisible] = useState(false);
  const [cleanBgUri, setCleanBgUri] = useState<string>('');

  const openCleanBg = async () => {
    setToolBusy(true);
    try {
      const local = await ensureLocalUri(displayUri, workingUri);
      if (workingUri !== local) { setWorkingUri(local); }
      setCleanBgUri(local);
      setCleanBgVisible(true);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not open editor');
    } finally {
      setToolBusy(false);
    }
  };

  const openCropRotate = async () => {
    setToolBusy(true);
    try {
      const local = await ensureLocalUri(displayUri, workingUri);
      if (workingUri !== local) { setWorkingUri(local); }
      navigation.navigate('CropRotate', { sourceUri: local, guideId: guide.id, guide });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not open crop editor');
    } finally {
      setToolBusy(false);
    }
  };

  const onClose = () => {
    if (dirty) {
      Alert.alert('Discard edits?', 'Your changes will be lost.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
      ]);
    } else {
      navigation.goBack();
    }
  };

  const onNext = async () => {
    setSaving(true);
    try {
      let nextGuide = guide;
      if (workingUri) {
        nextGuide = await apiClient.uploadGuideImage(guide.id, workingUri);
        setGuide(nextGuide);
        updateGuideInList(nextGuide);
      } else {
        nextGuide = await apiClient.getGuide(guide.id);
        updateGuideInList(nextGuide);
      }
      navigation.replace('GuideDetails', { guide: nextGuide });
      navigation.navigate('CameraOverlay', { guide: nextGuide });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.safe}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
        <TouchableOpacity style={styles.headerIconBtn} onPress={onClose} accessibilityLabel="Close">
          <Ionicons name="close" size={22} color={semantic.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Guide</Text>
        <TouchableOpacity
          style={[styles.nextBtn, saving && styles.nextBtnDisabled]}
          onPress={onNext}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <Text style={styles.nextBtnText}>Next</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.previewWrap}>
        {toolBusy ? (
          <View style={styles.previewLoading}>
            <ActivityIndicator color={semantic.accent} size="large" />
          </View>
        ) : null}
        {displayUri ? (
          <Image source={{ uri: displayUri }} style={styles.previewImage} resizeMode="contain" />
        ) : (
          <View style={styles.previewEmpty} />
        )}
      </View>

      <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <Text style={styles.panelLabel}>GUIDE NAME</Text>
        <View style={styles.nameRow}>
          <Ionicons name="create-outline" size={18} color={semantic.textSecondary} style={styles.nameIcon} />
          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={onNameChange}
            placeholder="e.g. Casual Pose 01"
            placeholderTextColor={semantic.textSecondary}
            returnKeyType="done"
            maxLength={120}
            selectionColor={semantic.accent}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.toolsRow}>
          <ToolItem styles={styles} icon="color-wand-outline" label="Clean BG" onPress={openCleanBg} disabled={toolBusy} semantic={semantic} />
          <ToolItem styles={styles} icon="crop-outline" label="Crop &amp; Rotate" onPress={openCropRotate} disabled={toolBusy} semantic={semantic} />
        </View>
      </View>

      <CleanBgModal
        visible={cleanBgVisible}
        imageUri={cleanBgUri}
        guideId={guide.id}
        onClose={() => setCleanBgVisible(false)}
        onDone={() => {
          setCleanBgVisible(false);
          setWorkingUri(null);
        }}
        onGuideUpdated={(g) => {
          setGuide(g);
          updateGuideInList(g);
          const next = getFullImageUrl(g.guideImageUrl);
          const base = FileSystem.cacheDirectory;
          if (base) {
            FileSystem.downloadAsync(next, `${base}clean_auto_${g.id}_${Date.now()}.png`).then((r) =>
              setCleanBgUri(r.uri),
            );
          }
        }}
      />
    </View>
  );
};

function ToolItem(props: {
  styles: ReturnType<typeof makeStyles>;
  semantic: SemanticColors;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { styles, semantic, icon, label, onPress, disabled } = props;
  return (
    <TouchableOpacity style={styles.tool} onPress={onPress} disabled={disabled} activeOpacity={0.75}>
      <View style={styles.toolIconWrap}>
        <Ionicons name={icon} size={22} color={semantic.text} />
      </View>
      <Text style={styles.toolLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function makeStyles(s: SemanticColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: s.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    headerIconBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: s.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: { fontSize: fontSize.lg, fontWeight: '600', color: s.text },
    nextBtn: {
      backgroundColor: s.accent,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      minWidth: 72,
      alignItems: 'center',
      justifyContent: 'center',
    },
    nextBtnDisabled: { opacity: 0.6 },
    nextBtnText: { color: s.accentText, fontWeight: '700', fontSize: fontSize.sm },
    previewWrap: {
      flex: 1,
      marginHorizontal: spacing.md,
      borderRadius: borderRadius.lg,
      overflow: 'hidden',
      backgroundColor: s.background,
    },
    previewLoading: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
      backgroundColor: 'rgba(0,0,0,0.25)',
    },
    previewImage: { width: '100%', height: '100%' },
    previewEmpty: { flex: 1, backgroundColor: s.surface },
    panel: {
      backgroundColor: s.surface,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      marginTop: spacing.sm,
    },
    panelLabel: {
      fontSize: fontSize.xs,
      letterSpacing: 1,
      color: s.textSecondary,
      fontWeight: '600',
      marginBottom: spacing.sm,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: s.surfaceMuted,
      borderRadius: borderRadius.full,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginBottom: spacing.sm,
    },
    nameIcon: { marginRight: spacing.sm },
    nameInput: { flex: 1, color: s.text, fontSize: fontSize.md, padding: 0 },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: s.border,
      marginVertical: spacing.md,
    },
    toolsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingBottom: spacing.sm,
    },
    tool: {
      alignItems: 'center',
      width: (SCREEN_W - spacing.lg * 2) / 2,
    },
    toolIconWrap: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: s.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    toolLabel: { fontSize: 11, color: s.text, textAlign: 'center' },
  });
}
