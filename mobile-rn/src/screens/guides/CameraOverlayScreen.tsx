import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { dark, spacing, borderRadius, fontSize } from '../../config/theme';
import { Guide } from '../../types/guide';
import { getFullImageUrl } from '../../config/api';
import { SessionCapture } from './SessionReviewScreen';
import { sessionCallbackStore } from './sessionCallbackStore';
import { useSessionRecentsStore } from '../../store/sessionRecentsStore';

type RouteParams = {
  CameraOverlay: { guide: Guide };
};

type ActiveTool = 'timer' | 'adjust' | 'flip' | 'linecolor';
type LineColor = 'dark' | 'light';
type TimerSec = 0 | 3 | 10;
type ZoomPreset = '0.5x' | '1x' | '2x' | '3x';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const THUMB_SIZE = 52;
const SHUTTER_OUTER = 80;
const SHUTTER_INNER = 62;

export const CameraOverlayScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'CameraOverlay'>>();
  const { guide } = route.params;
  const insets = useSafeAreaInsets();
  const addCapture = useSessionRecentsStore((state) => state.addCapture);

  const [permission, requestPermission] = useCameraPermissions();

  const [facing, setFacing] = useState<CameraType>('back');
  const [guideOpacity, setGuideOpacity] = useState(0.6);
  const [showGuide, setShowGuide] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [mirrorGuide, setMirrorGuide] = useState(false);
  const [lineColor, setLineColor] = useState<LineColor>('dark');
  const [activeTool, setActiveTool] = useState<ActiveTool>('adjust');
  const [timerSec, setTimerSec] = useState<TimerSec>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [sessionCaptures, setSessionCaptures] = useState<SessionCapture[]>([]);
  const [cameraZoom, setCameraZoom] = useState(0);
  const [zoomPreset, setZoomPreset] = useState<ZoomPreset>('1x');
  const [availableLenses, setAvailableLenses] = useState<string[]>([]);
  const [selectedLens, setSelectedLens] = useState<string | undefined>(
    Platform.OS === 'ios' ? 'builtInWideAngleCamera' : undefined,
  );

  const lastPhotoUri = sessionCaptures.length > 0
    ? sessionCaptures[sessionCaptures.length - 1].uri
    : null;

  // ── Reanimated shared values for guide transform ───────────────────────────
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const rotation = useSharedValue(0);
  const savedRotation = useSharedValue(0);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const mirrorScale = useSharedValue(1);

  // Keep mirror shared value in sync with React state
  useEffect(() => {
    mirrorScale.value = mirrorGuide ? -1 : 1;
  }, [mirrorGuide]);

  const animatedGuideStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotation.value}rad` },
      { scale: scale.value },
      // Mirror applied last so it doesn't flip the rotation direction
      { scaleX: mirrorScale.value },
    ],
  }));

  // ── isAdjustActive shared value so gesture .enabled() runs on UI thread ───
  const isAdjustActive = useSharedValue(activeTool === 'adjust');
  useEffect(() => {
    isAdjustActive.value = activeTool === 'adjust';
  }, [activeTool]);

  // ── Pan gesture ────────────────────────────────────────────────────────────
  const panGesture = Gesture.Pan()
    .minDistance(0)
    .onBegin(() => {
      'worklet';
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      'worklet';
      if (!isAdjustActive.value) { return; }
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .enabled(activeTool === 'adjust');

  // ── Rotation gesture (two-finger twist) ───────────────────────────────────
  const rotationGesture = Gesture.Rotation()
    .onBegin(() => {
      'worklet';
      savedRotation.value = rotation.value;
    })
    .onUpdate((e) => {
      'worklet';
      if (!isAdjustActive.value) { return; }
      rotation.value = savedRotation.value + e.rotation;
    })
    .enabled(activeTool === 'adjust');

  // ── Pinch gesture (two-finger spread/squeeze to zoom) ────────────────────
  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      'worklet';
      savedScale.value = scale.value;
    })
    .onUpdate((e) => {
      'worklet';
      if (!isAdjustActive.value) { return; }
      // Clamp between 0.2× and 4× so it doesn't get lost
      const next = savedScale.value * e.scale;
      scale.value = Math.min(Math.max(next, 0.2), 4);
    })
    .enabled(activeTool === 'adjust');

  // All three gestures active simultaneously (pan + rotate + pinch)
  const composed = Gesture.Simultaneous(panGesture, rotationGesture, pinchGesture);

  // ── Camera ────────────────────────────────────────────────────────────────
  const cameraRef = useRef<CameraView>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const guideImageUrl = `${getFullImageUrl(guide.guideImageUrl)}?cb=${encodeURIComponent(String(guide.updatedAt ?? ''))}`;

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, []);

  useEffect(() => {
    return () => {
      if (countdownRef.current) { clearInterval(countdownRef.current); }
    };
  }, []);

  const cycleTimer = () => {
    setTimerSec(prev => {
      if (prev === 0) { return 3; }
      if (prev === 3) { return 10; }
      return 0;
    });
    setActiveTool('timer');
  };

  const handleFlip = () => {
    setMirrorGuide(prev => !prev);
    setActiveTool('flip');
  };

  const handleLineColor = () => {
    setLineColor(prev => (prev === 'dark' ? 'light' : 'dark'));
    setActiveTool('linecolor');
  };

  const handleAdjust = () => {
    setActiveTool('adjust');
  };

  const doCapture = useCallback(async () => {
    if (!cameraRef.current) { return; }
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (photo?.uri) {
        const capture: SessionCapture = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          uri: photo.uri,
          createdAt: Date.now(),
        };
        setSessionCaptures(prev => [...prev, capture]);
        addCapture(capture);
      }
    } catch {
      // capture failed silently — user can retry
    }
  }, []);

  const onShutter = useCallback(() => {
    if (timerSec === 0) {
      doCapture();
      return;
    }
    setCountdown(timerSec);
    let remaining = timerSec;
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(countdownRef.current!);
        countdownRef.current = null;
        setCountdown(null);
        doCapture();
      } else {
        setCountdown(remaining);
      }
    }, 1000);
  }, [timerSec, doCapture]);

  const flipCamera = () => {
    setFacing(prev => (prev === 'back' ? 'front' : 'back'));
  };

  const canUseUltraWide = Platform.OS === 'ios'
    && facing === 'back'
    && availableLenses.includes('builtInUltraWideCamera');

  const zoomOptions: ZoomPreset[] = canUseUltraWide
    ? ['0.5x', '1x', '2x', '3x']
    : ['1x', '2x', '3x'];

  const applyZoomPreset = useCallback((preset: ZoomPreset) => {
    setZoomPreset(preset);

    // iPhone-like lens switching for back camera on iOS.
    if (Platform.OS === 'ios' && facing === 'back') {
      if (preset === '0.5x' && availableLenses.includes('builtInUltraWideCamera')) {
        setSelectedLens('builtInUltraWideCamera');
        setCameraZoom(0);
        return;
      }
      if (preset === '1x' && availableLenses.includes('builtInWideAngleCamera')) {
        setSelectedLens('builtInWideAngleCamera');
        setCameraZoom(0);
        return;
      }
      if (preset === '2x' && availableLenses.includes('builtInTelephotoCamera')) {
        setSelectedLens('builtInTelephotoCamera');
        setCameraZoom(0);
        return;
      }
      if (availableLenses.includes('builtInWideAngleCamera')) {
        setSelectedLens('builtInWideAngleCamera');
      }
    }

    // Fallback digital zoom for unsupported lens levels / non-iOS.
    if (preset === '0.5x' || preset === '1x') {
      setCameraZoom(0);
    } else if (preset === '2x') {
      setCameraZoom(0.3);
    } else {
      setCameraZoom(0.55);
    }
  }, [availableLenses, facing]);

  useEffect(() => {
    // Keep default at 1x on iOS by preferring wide-angle lens.
    if (Platform.OS !== 'ios') { return; }
    if (facing !== 'back') {
      setSelectedLens(undefined);
      return;
    }
    if (availableLenses.includes('builtInWideAngleCamera')) {
      setSelectedLens('builtInWideAngleCamera');
    } else if (availableLenses.length > 0) {
      setSelectedLens(availableLenses[0]);
    }
  }, [availableLenses, facing]);

  useEffect(() => {
    if (zoomPreset === '0.5x' && !canUseUltraWide) {
      applyZoomPreset('1x');
    }
  }, [zoomPreset, canUseUltraWide, applyZoomPreset]);

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.permissionWrap}>
          <Ionicons name="camera-outline" size={56} color={dark.textSecondary} />
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionSub}>Allow camera access to use pose guide overlay.</Text>
          <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
            <Text style={styles.permissionBtnText}>Allow Camera</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Live camera */}
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        zoom={cameraZoom}
        selectedLens={Platform.OS === 'ios' ? selectedLens : undefined}
        onAvailableLensesChanged={(event) => {
          setAvailableLenses(event.lenses ?? []);
        }}
      />

      {/* Rule-of-thirds grid */}
      {showGrid && <GridOverlay />}

      {/* Guide pose overlay — pan + rotate with two fingers */}
      {showGuide && (
        <GestureDetector gesture={composed}>
          <Animated.View style={[styles.guideWrapper, animatedGuideStyle]}>
            <Image
              source={{ uri: guideImageUrl }}
              style={[styles.guideOverlay, { opacity: guideOpacity, tintColor: lineColor === 'light' ? '#ffffff' : '#000000' }]}
              resizeMode="contain"
            />
          </Animated.View>
        </GestureDetector>
      )}

      {/* Countdown display */}
      {countdown !== null && (
        <View style={styles.countdownWrap} pointerEvents="none">
          <Text style={styles.countdownText}>{countdown}</Text>
        </View>
      )}

      {/* ── Top bar ── */}
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.xs }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.iconBtn} onPress={() => setShowGrid(g => !g)}>
          <Ionicons name="grid-outline" size={22} color={showGrid ? dark.accent : '#fff'} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.iconBtn}>
          <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ── Opacity ruler ── */}
      <View style={styles.opacityRow}>
        <TouchableOpacity onPress={() => { setShowGuide(false); setGuideOpacity(0); }}>
          <Ionicons
            name="eye-off-outline"
            size={22}
            color={showGuide ? 'rgba(255,255,255,0.5)' : dark.accent}
          />
        </TouchableOpacity>
        <Slider
          style={styles.opacitySlider}
          minimumValue={0}
          maximumValue={1}
          step={0.01}
          value={guideOpacity}
          onValueChange={(v) => {
            setGuideOpacity(v);
            setShowGuide(v > 0);
          }}
          minimumTrackTintColor={dark.accent}
          maximumTrackTintColor="rgba(255,255,255,0.25)"
          thumbTintColor={dark.accent}
        />
        <TouchableOpacity onPress={() => { setShowGuide(true); setGuideOpacity(1); }}>
          <Ionicons
            name="eye-outline"
            size={22}
            color={guideOpacity >= 0.99 ? dark.accent : 'rgba(255,255,255,0.5)'}
          />
        </TouchableOpacity>
      </View>

      {/* ── Bottom panel ── */}
      <SafeAreaView edges={['bottom']} style={styles.bottomPanel}>
        {/* Tool row: Timer | Adjust | Flip */}
        <View style={styles.toolRow}>
          {/* Timer */}
          <TouchableOpacity style={styles.toolBtn} onPress={cycleTimer}>
            <Ionicons
              name="timer-outline"
              size={22}
              color={activeTool === 'timer' && timerSec > 0 ? dark.accent : '#fff'}
            />
            <Text style={[styles.toolLabel, activeTool === 'timer' && timerSec > 0 && styles.toolLabelActive]}>
              {timerSec === 0 ? 'Timer' : `${timerSec}S`}
            </Text>
          </TouchableOpacity>

          {/* Adjust */}
          <TouchableOpacity style={styles.toolBtn} onPress={handleAdjust}>
            <Ionicons
              name="move-outline"
              size={22}
              color={activeTool === 'adjust' ? dark.accent : '#fff'}
            />
            <Text style={[styles.toolLabel, activeTool === 'adjust' && styles.toolLabelActive]}>
              Adjust
            </Text>
          </TouchableOpacity>

          {/* Flip guide */}
          <TouchableOpacity style={styles.toolBtn} onPress={handleFlip}>
            <Ionicons
              name="swap-horizontal-outline"
              size={22}
              color={mirrorGuide ? dark.accent : '#fff'}
            />
            <Text style={[styles.toolLabel, mirrorGuide && styles.toolLabelActive]}>
              Flip
            </Text>
          </TouchableOpacity>

          {/* Line color toggle: Dark / Light */}
          <TouchableOpacity style={styles.toolBtn} onPress={handleLineColor}>
            <Ionicons
              name={lineColor === 'light' ? 'sunny-outline' : 'moon-outline'}
              size={22}
              color={activeTool === 'linecolor' ? dark.accent : '#fff'}
            />
            <Text style={[styles.toolLabel, activeTool === 'linecolor' && styles.toolLabelActive]}>
              {lineColor === 'light' ? 'Light' : 'Dark'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Action row: thumbnail | shutter | camera-switch */}
        <View style={styles.actionRow}>
          {/* Last photo thumbnail — opens session review */}
          <TouchableOpacity
            style={styles.thumbnailBtn}
            onPress={() => {
              if (sessionCaptures.length === 0) { return; }
              sessionCallbackStore.set((updated: SessionCapture[]) => {
                setSessionCaptures(updated);
              });
              navigation.navigate('SessionReview', {
                captures: sessionCaptures,
                poseName: guide.name ?? 'Pose',
              });
            }}
          >
            {lastPhotoUri ? (
              <>
                <Image source={{ uri: lastPhotoUri }} style={styles.thumbnail} resizeMode="cover" />
                {sessionCaptures.length > 1 && (
                  <View style={styles.captureCountBadge}>
                    <Text style={styles.captureCountText}>{sessionCaptures.length}</Text>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.thumbnailPlaceholder}>
                <Ionicons name="image-outline" size={24} color="rgba(255,255,255,0.4)" />
              </View>
            )}
          </TouchableOpacity>

          {/* Shutter */}
          <TouchableOpacity
            style={styles.shutterOuter}
            onPress={countdown === null ? onShutter : undefined}
            activeOpacity={0.8}
          >
            <View style={styles.shutterRing} />
            <View style={styles.shutterInner} />
          </TouchableOpacity>

          {/* Camera facing toggle */}
          <TouchableOpacity style={styles.cameraFlipBtn} onPress={flipCamera}>
            <Ionicons name="camera-reverse-outline" size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* iPhone-style zoom controls */}
        <View style={styles.zoomRow}>
          <View style={styles.zoomCapsule}>
            {zoomOptions.map((option) => {
              const isActive = zoomPreset === option;
              return (
                <TouchableOpacity
                  key={option}
                  style={[styles.zoomChip, isActive && styles.zoomChipActive]}
                  onPress={() => applyZoomPreset(option)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.zoomChipText, isActive && styles.zoomChipTextActive]}>
                    {option.replace('x', '')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </SafeAreaView>

    </View>
  );
};

// ── Rule-of-thirds grid ────────────────────────────────────────────────────────
const GridOverlay: React.FC = () => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    {[1, 2].map(i => (
      <View
        key={`h${i}`}
        style={[
          styles.gridLine,
          { top: (SCREEN_H / 3) * i, left: 0, right: 0, height: StyleSheet.hairlineWidth },
        ]}
      />
    ))}
    {[1, 2].map(i => (
      <View
        key={`v${i}`}
        style={[
          styles.gridLine,
          { left: (SCREEN_W / 3) * i, top: 0, bottom: 0, width: StyleSheet.hairlineWidth },
        ]}
      />
    ))}
  </View>
);

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  guideWrapper: {
    ...StyleSheet.absoluteFillObject,
  },
  guideOverlay: {
    width: SCREEN_W,
    height: SCREEN_H,
  },
  countdownWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countdownText: {
    fontSize: 120,
    fontWeight: '700',
    color: dark.accent,
    opacity: 0.9,
  },

  // Top bar
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    zIndex: 20,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Opacity ruler
  opacityRow: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: 220,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  opacitySlider: {
    flex: 1,
    height: 40,
    marginHorizontal: spacing.sm,
  },

  // Bottom panel
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingTop: spacing.md,
    zIndex: 10,
  },
  toolRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  toolBtn: {
    alignItems: 'center',
    minWidth: 64,
  },
  toolLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: fontSize.xs,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  toolLabelActive: {
    color: dark.accent,
  },

  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
  },
  zoomRow: {
    alignItems: 'center',
    paddingBottom: spacing.sm,
  },
  zoomCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  zoomChip: {
    minWidth: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  zoomChipActive: {
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  zoomChipText: {
    color: '#fff',
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  zoomChipTextActive: {
    color: '#000',
  },

  // Thumbnail
  thumbnailBtn: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  thumbnail: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
  },
  thumbnailPlaceholder: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureCountBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: dark.accent,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  captureCountText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '700',
  },

  // Shutter
  shutterOuter: {
    width: SHUTTER_OUTER,
    height: SHUTTER_OUTER,
    borderRadius: SHUTTER_OUTER / 2,
    backgroundColor: 'rgba(0,0,0,0)',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterRing: {
    position: 'absolute',
    width: SHUTTER_OUTER - 6,
    height: SHUTTER_OUTER - 6,
    borderRadius: (SHUTTER_OUTER - 6) / 2,
    borderWidth: 3,
    borderColor: dark.accent,
  },
  shutterInner: {
    width: SHUTTER_INNER,
    height: SHUTTER_INNER,
    borderRadius: SHUTTER_INNER / 2,
    backgroundColor: dark.accent,
  },

  // Camera flip
  cameraFlipBtn: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Grid
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  // Permission screen
  permissionWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  permissionTitle: {
    color: dark.text,
    fontSize: fontSize.xl,
    fontWeight: '600',
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  permissionSub: {
    color: dark.textSecondary,
    fontSize: fontSize.md,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  permissionBtn: {
    marginTop: spacing.xl,
    backgroundColor: dark.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.full,
  },
  permissionBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: fontSize.md,
  },

});
