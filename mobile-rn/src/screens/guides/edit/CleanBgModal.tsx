import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  LayoutChangeEvent,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dark, spacing, borderRadius, fontSize } from '../../../config/theme';
import { apiClient } from '../../../api/client';
import { Guide } from '../../../types/guide';
import { containLayout, layoutToImage } from './geometry';

type Point = { x: number; y: number };

type Props = {
  visible: boolean;
  imageUri: string;
  guideId: string;
  onClose: () => void;
  onDone: () => void;
  onGuideUpdated: (guide: Guide) => void;
};

export const CleanBgModal: React.FC<Props> = ({
  visible,
  imageUri,
  guideId,
  onClose,
  onDone,
  onGuideUpdated,
}) => {
  const [layout, setLayout] = useState({ w: 1, h: 1 });
  const [imageSize, setImageSize] = useState({ w: 1, h: 1 });
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [pendingStroke, setPendingStroke] = useState<Point[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);
  const insets = useSafeAreaInsets();

  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const imageSizeRef = useRef(imageSize);
  imageSizeRef.current = imageSize;

  useEffect(() => {
    if (!visible) {
      setUndoCount(0);
      setRedoCount(0);
    }
  }, [visible]);

  useEffect(() => {
    if (!imageUri) {
      return;
    }
    Image.getSize(
      imageUri,
      (w, h) => setImageSize({ w: Math.max(1, w), h: Math.max(1, h) }),
      () => setImageSize({ w: 1000, h: 1000 })
    );
  }, [imageUri]);

  const geom = useMemo(
    () => containLayout(imageSize.w, imageSize.h, layout.w, layout.h),
    [imageSize.w, imageSize.h, layout.w, layout.h]
  );

  const commitStroke = async (stroke: Point[]) => {
    if (stroke.length < 2) {
      return;
    }
    const L = layoutRef.current;
    const I = imageSizeRef.current;
    const mapped = stroke
      .map((p) => {
        const pt = layoutToImage(p.x, p.y, I.w, I.h, L.w, L.h);
        return {
          x: Math.max(0, Math.min(I.w, pt.ix)),
          y: Math.max(0, Math.min(I.h, pt.iy)),
        };
      })
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));

    if (mapped.length === 0) {
      return;
    }

    setPendingStroke(stroke);
    setBusy(true);
    try {
      const res = await apiClient.eraseGuideByStrokes(guideId, {
        strokes: [mapped],
        brushSize: 30,
      });
      onGuideUpdated(res.guide);
      setUndoCount(res.undoCount);
      setRedoCount(res.redoCount);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Erase failed');
    } finally {
      setPendingStroke(null);
      setBusy(false);
    }
  };

  const onUndo = async () => {
    if (busy || undoCount === 0) return;
    setBusy(true);
    try {
      const res = await apiClient.undoEraseGuide(guideId);
      onGuideUpdated(res.guide);
      setUndoCount(res.undoCount);
      setRedoCount(res.redoCount);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Undo failed');
    } finally {
      setBusy(false);
    }
  };

  const onRedo = async () => {
    if (busy || redoCount === 0) return;
    setBusy(true);
    try {
      const res = await apiClient.redoEraseGuide(guideId);
      onGuideUpdated(res.guide);
      setUndoCount(res.undoCount);
      setRedoCount(res.redoCount);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Redo failed');
    } finally {
      setBusy(false);
    }
  };

  const onLayoutCanvas = (e: LayoutChangeEvent): void => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setLayout({ w: width, h: height });
    }
  };

  const overlayStrokes: Point[][] = [];
  if (pendingStroke) overlayStrokes.push(pendingStroke);
  if (currentStroke.length > 0) overlayStrokes.push(currentStroke);

  const undoDisabled = busy || undoCount === 0;
  const redoDisabled = busy || redoCount === 0;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom }]}>
        <View style={styles.toolbar}>
          <TouchableOpacity onPress={onClose} style={styles.tbBtn} disabled={busy}>
            <Text style={[styles.tbBtnText, busy && styles.btnDisabled]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.tbTitle}>Clean background</Text>
          <TouchableOpacity onPress={onDone} style={styles.tbBtn} disabled={busy}>
            {busy
              ? <ActivityIndicator color={dark.accent} size="small" />
              : <Text style={[styles.tbBtnText, styles.tbDoneText]}>Done</Text>
            }
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>Paint with your finger — each stroke erases on release</Text>

        <View style={styles.canvasShell} onLayout={onLayoutCanvas}>
          <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
          <View
            style={StyleSheet.absoluteFill}
            onStartShouldSetResponder={() => !busy}
            onMoveShouldSetResponder={() => !busy}
            onResponderGrant={(ev) => {
              const { locationX, locationY } = ev.nativeEvent;
              setCurrentStroke([{ x: locationX, y: locationY }]);
            }}
            onResponderMove={(ev) => {
              const { locationX, locationY } = ev.nativeEvent;
              setCurrentStroke((s) => [...s, { x: locationX, y: locationY }]);
            }}
            onResponderRelease={() => {
              setCurrentStroke((s) => {
                if (s.length > 1) {
                  void commitStroke(s);
                }
                return [];
              });
            }}
            onResponderTerminate={() => {
              setCurrentStroke((s) => {
                if (s.length > 1) {
                  void commitStroke(s);
                }
                return [];
              });
            }}
          />
          {overlayStrokes.map((stroke, si) =>
            stroke.map((p, pi) => (
              <View
                key={`${si}-${pi}`}
                style={[
                  styles.strokeDot,
                  {
                    left: p.x - 14,
                    top: p.y - 14,
                  },
                ]}
              />
            ))
          )}
          <View
            pointerEvents="none"
            style={[
              styles.imageBounds,
              {
                left: geom.ox,
                top: geom.oy,
                width: geom.dw,
                height: geom.dh,
              },
            ]}
          />
        </View>

        <View style={styles.bottomBar}>
          <TouchableOpacity
            onPress={onUndo}
            disabled={undoDisabled}
            style={[styles.iconBtn, undoDisabled && styles.btnDisabled]}
            accessibilityLabel="Undo"
          >
            <Ionicons name="arrow-undo" size={24} color={dark.text} />
            <Text style={styles.iconLabel}>Undo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onRedo}
            disabled={redoDisabled}
            style={[styles.iconBtn, redoDisabled && styles.btnDisabled]}
            accessibilityLabel="Redo"
          >
            <Ionicons name="arrow-redo" size={24} color={dark.text} />
            <Text style={styles.iconLabel}>Redo</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: dark.background,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  tbBtn: {
    padding: spacing.sm,
  },
  tbBtnText: {
    color: dark.textSecondary,
    fontSize: fontSize.md,
  },
  tbDoneText: {
    color: dark.accent,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.35,
  },
  tbTitle: {
    color: dark.text,
    fontWeight: '600',
    fontSize: fontSize.md,
  },
  hint: {
    color: dark.textSecondary,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  canvasShell: {
    flex: 1,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: dark.surface,
  },
  strokeDot: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 60, 60, 0.5)',
  },
  imageBounds: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: dark.border,
  },
  iconBtn: {
    alignItems: 'center',
    padding: spacing.sm,
  },
  iconLabel: {
    color: dark.textSecondary,
    fontSize: fontSize.xs,
    marginTop: 4,
  },
});
