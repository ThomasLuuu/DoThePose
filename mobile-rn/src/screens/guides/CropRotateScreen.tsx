import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { dark, spacing, borderRadius, fontSize } from '../../config/theme';
import { Guide } from '../../types/guide';
import {
  containLayout,
  imageRectToLayout,
  clampCrop,
  applyAspectLock,
  hitTestHandle,
  HandleKind,
} from './edit/geometry';

// ─── Types ────────────────────────────────────────────────────────────────────

type Crop = { x: number; y: number; w: number; h: number };

type RouteParams = {
  CropRotate: {
    sourceUri: string;
    initialWidth?: number;
    initialHeight?: number;
    guideId: string;
    /** Full guide object passed through so we can return it to EditGuide intact. */
    guide: Guide;
  };
};

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT = '#FFD60A';
const CORNER_LEN = 24;   // px length of each L-tick arm
const CORNER_W = 3;      // px thickness of L-tick arm
const CORNER_ZONE = 60;  // layout-px hit zone at each corner

const SCREEN_W = Dimensions.get('window').width;
const TICK_RANGE = 45;
// How many screen pixels equal 1 degree on the ruler
const PPD = (SCREEN_W * 0.9) / (TICK_RANGE * 2);

const RATIOS: Array<{ label: string; value: number | null; tall: boolean }> = [
  { label: 'Custom', value: null, tall: false },
  { label: '1:1',   value: 1,    tall: false },
  { label: '3:4',   value: 3/4,  tall: true  },
  { label: '4:3',   value: 4/3,  tall: false },
  { label: '16:9',  value: 16/9, tall: false },
];

// ─── Component ────────────────────────────────────────────────────────────────

export const CropRotateScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'CropRotate'>>();
  const insets = useSafeAreaInsets();
  const { sourceUri, initialWidth, initialHeight, guide } = route.params;

  // ── Working image ──
  const [workingUri, setWorkingUri] = useState<string>(sourceUri);
  const [imgSize, setImgSize] = useState<{ w: number; h: number }>({
    w: initialWidth ?? 1000,
    h: initialHeight ?? 1000,
  });
  const [baking, setBaking] = useState(false);

  // ── Transform ──
  // `rotation` is what the ruler shows (live, any integer in [-45, 45])
  // `bakedRotation` is what's actually baked into workingUri
  const rotationRef = useRef(0);
  const [rotationDisplay, setRotationDisplay] = useState(0);
  const [bakedRotation, setBakedRotation] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [bakedFlipped, setBakedFlipped] = useState(false);

  // ── Crop ──
  const makeCrop = useCallback((iw: number, ih: number): Crop => {
    // Start at 92 % of image centred — handles are visible and crop is movable
    const pad = 0.04;
    const cw = iw * (1 - pad * 2);
    const ch = ih * (1 - pad * 2);
    return { x: iw * pad, y: ih * pad, w: cw, h: ch };
  }, []);

  const [crop, setCrop] = useState<Crop>(() => makeCrop(imgSize.w, imgSize.h));
  const cropRef = useRef(crop);
  cropRef.current = crop;
  const [selectedRatio, setSelectedRatio] = useState<number | null>(null);
  const selectedRatioRef = useRef<number | null>(null);
  selectedRatioRef.current = selectedRatio;

  // ── Canvas layout ──
  const [box, setBox] = useState({ w: 1, h: 1 });
  const boxRef = useRef({ w: 1, h: 1 });
  const onLayoutBox = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 1 && height > 1) {
      setBox({ w: width, h: height });
      boxRef.current = { w: width, h: height };
    }
  };

  // ── Bake (called only on ruler release or flip) ──
  const bakeTransform = useCallback(async (deg: number, isFlipped: boolean) => {
    setBaking(true);
    try {
      const actions: ImageManipulator.Action[] = [];
      if (isFlipped) {
        actions.push({ flip: ImageManipulator.FlipType.Horizontal });
      }
      if (deg !== 0) {
        actions.push({ rotate: deg });
      }
      const result = await ImageManipulator.manipulateAsync(
        sourceUri,
        actions.length ? actions : [{ rotate: 0 }],
        { compress: 1, format: ImageManipulator.SaveFormat.PNG }
      );
      const [nw, nh] = await new Promise<[number, number]>((res) =>
        Image.getSize(result.uri, (w, h) => res([w, h]), () => res([imgSize.w, imgSize.h]))
      );
      setWorkingUri(result.uri);
      setImgSize({ w: nw, h: nh });
      setCrop(makeCrop(nw, nh));
      setBakedRotation(deg);
      setBakedFlipped(isFlipped);
    } catch {
      // leave previous state intact
    } finally {
      setBaking(false);
    }
  }, [sourceUri, imgSize.w, imgSize.h, makeCrop]);

  // ── Flip ──
  const onFlip = useCallback(() => {
    const next = !flipped;
    setFlipped(next);
    bakeTransform(rotationRef.current, next);
  }, [flipped, bakeTransform]);

  // ── Confirm ──
  const onConfirm = useCallback(async () => {
    setBaking(true);
    try {
      const deg = rotationRef.current;
      let uri = workingUri;
      let iw = imgSize.w;
      let ih = imgSize.h;
      // Bake if there's a pending rotation that wasn't committed yet
      if (deg !== bakedRotation || flipped !== bakedFlipped) {
        const actions: ImageManipulator.Action[] = [];
        if (flipped) { actions.push({ flip: ImageManipulator.FlipType.Horizontal }); }
        if (deg !== 0) { actions.push({ rotate: deg }); }
        const r = await ImageManipulator.manipulateAsync(
          sourceUri,
          actions.length ? actions : [{ rotate: 0 }],
          { compress: 1, format: ImageManipulator.SaveFormat.PNG }
        );
        uri = r.uri;
        [iw, ih] = await new Promise<[number, number]>((res) =>
          Image.getSize(uri, (w, h) => res([w, h]), () => res([iw, ih]))
        );
      }
      const c = cropRef.current;
      const finalResult = await ImageManipulator.manipulateAsync(
        uri,
        [{
          crop: {
            originX: Math.max(0, Math.round(c.x)),
            originY: Math.max(0, Math.round(c.y)),
            width: Math.min(iw - Math.round(c.x), Math.max(1, Math.round(c.w))),
            height: Math.min(ih - Math.round(c.y), Math.max(1, Math.round(c.h))),
          },
        }],
        { compress: 1, format: ImageManipulator.SaveFormat.PNG }
      );
      // Navigate back with the original guide + the new URI.
      // Pass guide explicitly so EditGuide always has a valid guide object
      // (merge:true is unreliable in RN7 native-stack and can drop params).
      navigation.navigate('EditGuide', { guide, appliedEditUri: finalResult.uri });
    } catch {
      setBaking(false);
    }
  }, [workingUri, imgSize, bakedRotation, bakedFlipped, flipped, sourceUri, navigation]);

  // ── Ratio preset ──
  const onSelectRatio = useCallback((ratio: number | null) => {
    setSelectedRatio(ratio);
    if (ratio === null) { return; }
    const iw = imgSize.w;
    const ih = imgSize.h;
    let nw = iw;
    let nh = nw / ratio;
    if (nh > ih) { nh = ih; nw = nh * ratio; }
    const nx = (iw - nw) / 2;
    const ny = (ih - nh) / 2;
    setCrop(clampCrop(nx, ny, nw, nh, iw, ih));
  }, [imgSize]);

  // ── Crop PanResponder ─────────────────────────────────────────────────────
  // Uses gestureState.dx/dy (total delta from grant) — immune to re-renders.
  const imgSizeRef = useRef(imgSize);
  imgSizeRef.current = imgSize;

  const cropDragRef = useRef<{
    kind: HandleKind;
    startCrop: Crop;
    scale: number;
  } | null>(null);

  // Stable PanResponder that reads state via refs
  const cropPan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      const lx = e.nativeEvent.locationX;
      const ly = e.nativeEvent.locationY;
      const { w: iw, h: ih } = imgSizeRef.current;
      const { w: bw, h: bh } = boxRef.current;
      const frame = imageRectToLayout(
        cropRef.current.x, cropRef.current.y,
        cropRef.current.w, cropRef.current.h,
        iw, ih, bw, bh
      );
      const kind = hitTestHandle(lx, ly, frame, CORNER_ZONE);
      if (!kind) {
        cropDragRef.current = null;
        return;
      }
      const { scale } = containLayout(iw, ih, bw, bh);
      cropDragRef.current = { kind, startCrop: { ...cropRef.current }, scale };
    },
    onPanResponderMove: (_, gs) => {
      if (!cropDragRef.current) { return; }
      const { kind, startCrop, scale } = cropDragRef.current;
      const { w: iw, h: ih } = imgSizeRef.current;
      // Convert layout-space gesture delta to image-space delta
      const dix = gs.dx / scale;
      const diy = gs.dy / scale;

      if (kind === 'move') {
        const nx = Math.max(0, Math.min(startCrop.x + dix, iw - startCrop.w));
        const ny = Math.max(0, Math.min(startCrop.y + diy, ih - startCrop.h));
        setCrop({ ...startCrop, x: nx, y: ny });
        return;
      }

      let nx = startCrop.x;
      let ny = startCrop.y;
      let nw = startCrop.w;
      let nh = startCrop.h;

      if (kind === 'tl') {
        const brX = startCrop.x + startCrop.w;
        const brY = startCrop.y + startCrop.h;
        nx = Math.max(0, Math.min(startCrop.x + dix, brX - 20));
        ny = Math.max(0, Math.min(startCrop.y + diy, brY - 20));
        nw = brX - nx;
        nh = brY - ny;
      } else if (kind === 'tr') {
        const brY = startCrop.y + startCrop.h;
        nw = Math.max(20, startCrop.w + dix);
        ny = Math.max(0, Math.min(startCrop.y + diy, brY - 20));
        nh = brY - ny;
      } else if (kind === 'bl') {
        const brX = startCrop.x + startCrop.w;
        nx = Math.max(0, Math.min(startCrop.x + dix, brX - 20));
        nw = brX - nx;
        nh = Math.max(20, startCrop.h + diy);
      } else {
        // br
        nw = Math.max(20, startCrop.w + dix);
        nh = Math.max(20, startCrop.h + diy);
      }

      const ratio = selectedRatioRef.current;
      if (ratio) {
        const anchorY = (kind === 'tl' || kind === 'tr') ? startCrop.y + startCrop.h : startCrop.y;
        setCrop(applyAspectLock(nx, ny, nw, nh, ratio, nx, anchorY, iw, ih));
      } else {
        setCrop(clampCrop(nx, ny, nw, nh, iw, ih));
      }
    },
    onPanResponderRelease: () => { cropDragRef.current = null; },
    onPanResponderTerminate: () => { cropDragRef.current = null; },
  }), []); // stable — all state read via refs

  // ── Layout frame (derived) ─────────────────────────────────────────────────
  const layoutFrame = useMemo(
    () => imageRectToLayout(crop.x, crop.y, crop.w, crop.h, imgSize.w, imgSize.h, box.w, box.h),
    [crop, imgSize, box]
  );
  const { left: fx, top: fy, width: fw, height: fh } = layoutFrame;

  // Live visual rotation (no bake needed while ruler is dragged)
  const liveRotation = rotationDisplay - bakedRotation;

  return (
    <View style={styles.safe}>
      {/* Header — paddingTop comes from insets so buttons are never under the status bar */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
        <TouchableOpacity
          style={styles.circleBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={22} color={dark.text} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Crop &amp; Rotate</Text>

        <TouchableOpacity
          style={[styles.circleBtn, styles.circleBtnAccent]}
          onPress={onConfirm}
          disabled={baking}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {baking ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Ionicons name="checkmark" size={22} color="#000" />
          )}
        </TouchableOpacity>
      </View>

      {/* Image canvas */}
      <View style={styles.canvas} onLayout={onLayoutBox}>
        {baking && (
          <View style={styles.bakingOverlay} pointerEvents="none">
            <ActivityIndicator color={ACCENT} size="large" />
          </View>
        )}

        <Image
          source={{ uri: workingUri }}
          style={[styles.image, { transform: [{ rotate: `${liveRotation}deg` }] }]}
          resizeMode="contain"
        />

        {/* Gesture layer — covers entire canvas; visual children are pointerEvents="none" */}
        <View style={StyleSheet.absoluteFill} {...cropPan.panHandlers}>
          {/* Four dim rectangles surrounding crop frame */}
          <View
            pointerEvents="none"
            style={[styles.dim, { top: 0, left: 0, right: 0, height: fy }]}
          />
          <View
            pointerEvents="none"
            style={[styles.dim, { top: fy, left: 0, width: fx, height: fh }]}
          />
          <View
            pointerEvents="none"
            style={[styles.dim, { top: fy, left: fx + fw, right: 0, height: fh }]}
          />
          <View
            pointerEvents="none"
            style={[styles.dim, { top: fy + fh, left: 0, right: 0, bottom: 0 }]}
          />

          {/* Crop frame with grid and L-corner ticks */}
          <View
            pointerEvents="none"
            style={[styles.cropFrame, { left: fx, top: fy, width: fw, height: fh }]}
          >
            {/* Rule-of-thirds grid */}
            <View style={[styles.gridLineV, { left: fw / 3 }]} />
            <View style={[styles.gridLineV, { left: (fw / 3) * 2 }]} />
            <View style={[styles.gridLineH, { top: fh / 3 }]} />
            <View style={[styles.gridLineH, { top: (fh / 3) * 2 }]} />

            {/* L-corner ticks */}
            <CornerTick corner="tl" />
            <CornerTick corner="tr" />
            <CornerTick corner="bl" />
            <CornerTick corner="br" />
          </View>
        </View>
      </View>

      {/* Rotation label */}
      <Text style={styles.rotLabel}>
        {rotationDisplay === 0 ? '0°' : rotationDisplay > 0 ? `+${rotationDisplay}°` : `${rotationDisplay}°`}
      </Text>

      {/* Ruler */}
      <Ruler
        valueRef={rotationRef}
        onChangeLive={(v) => setRotationDisplay(v)}
        onRelease={(v) => {
          rotationRef.current = v;
          setRotationDisplay(v);
          bakeTransform(v, flipped);
        }}
      />

      {/* Bottom sheet */}
      <View style={[styles.bottomSheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        {/* Flip */}
        <TouchableOpacity style={styles.flipBtn} onPress={onFlip} activeOpacity={0.7}>
          <Ionicons name="swap-horizontal" size={20} color={dark.text} />
          <Text style={styles.flipLabel}>Flip</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Ratio presets */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.ratioRow}
        >
          {RATIOS.map((r) => {
            const active = selectedRatio === r.value;
            return (
              <Pressable
                key={r.label}
                style={[styles.ratioChip, active && styles.ratioChipActive]}
                onPress={() => onSelectRatio(r.value)}
              >
                <RatioShape tall={r.tall} square={r.value === 1} />
                <Text style={[styles.ratioLabel, active && styles.ratioLabelActive]}>
                  {r.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
};

// ─── L-corner tick ────────────────────────────────────────────────────────────

function CornerTick({ corner }: { corner: 'tl' | 'tr' | 'bl' | 'br' }) {
  const isTop  = corner[0] === 't';
  const isLeft = corner[1] === 'l';
  const vEdge  = isTop  ? 'top'    : 'bottom';
  const hEdge  = isLeft ? 'left'   : 'right';
  return (
    <>
      {/* Horizontal arm */}
      <View style={[styles.cornerArm, {
        [vEdge]: 0,
        [hEdge]: 0,
        width: CORNER_LEN,
        height: CORNER_W,
      }]} />
      {/* Vertical arm */}
      <View style={[styles.cornerArm, {
        [vEdge]: 0,
        [hEdge]: 0,
        width: CORNER_W,
        height: CORNER_LEN,
      }]} />
    </>
  );
}

// ─── Ratio shape icon ─────────────────────────────────────────────────────────

function RatioShape({ tall, square }: { tall: boolean; square: boolean }) {
  const w = square ? 20 : tall ? 14 : 20;
  const h = square ? 20 : tall ? 22 : 14;
  return (
    <View style={[ratioIconStyles.base, { width: w, height: h }]} />
  );
}

const ratioIconStyles = StyleSheet.create({
  base: {
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
});

// ─── Ruler ────────────────────────────────────────────────────────────────────
// PanResponder never recreates (deps = []). All state read via refs.

function Ruler({
  valueRef,
  onChangeLive,
  onRelease,
}: {
  valueRef: React.MutableRefObject<number>;
  onChangeLive: (v: number) => void;
  onRelease: (v: number) => void;
}) {
  // Keep callbacks stable — store in refs to avoid stale closures
  const onChangeLiveRef = useRef(onChangeLive);
  onChangeLiveRef.current = onChangeLive;
  const onReleaseRef = useRef(onRelease);
  onReleaseRef.current = onRelease;

  // Value shown in UI (for tick positions only)
  const [displayValue, setDisplayValue] = useState(0);
  const displayRef = useRef(0);

  const startValRef = useRef(0);

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      startValRef.current = valueRef.current;
    },
    onPanResponderMove: (_, gs) => {
      // Drag right → ruler scrolls right → lower number (counter-clockwise)
      const delta = -(gs.dx / PPD);
      const raw = startValRef.current + delta;
      const v = Math.round(Math.max(-TICK_RANGE, Math.min(TICK_RANGE, raw)));
      displayRef.current = v;
      setDisplayValue(v);
      onChangeLiveRef.current(v);
    },
    onPanResponderRelease: (_, gs) => {
      const delta = -(gs.dx / PPD);
      const raw = startValRef.current + delta;
      const v = Math.round(Math.max(-TICK_RANGE, Math.min(TICK_RANGE, raw)));
      displayRef.current = v;
      setDisplayValue(v);
      onReleaseRef.current(v);
    },
    onPanResponderTerminate: () => {
      // Snap back to last committed value on cancel
      const v = valueRef.current;
      setDisplayValue(v);
      onChangeLiveRef.current(v);
    },
  }), []); // stable — no deps

  // Build tick positions
  const ticks: Array<{ d: number; major: boolean }> = [];
  for (let d = -TICK_RANGE; d <= TICK_RANGE; d += 5) {
    ticks.push({ d, major: d % 15 === 0 });
  }

  return (
    <View style={rulerStyles.track} {...pan.panHandlers}>
      {/* Ticks */}
      {ticks.map(({ d, major }) => {
        const px = (d - displayValue) * PPD + SCREEN_W / 2;
        if (px < -30 || px > SCREEN_W + 30) { return null; }
        return (
          <View
            key={d}
            pointerEvents="none"
            style={[
              rulerStyles.tick,
              major ? rulerStyles.tickMajor : rulerStyles.tickMinor,
              { left: px - 1 },
            ]}
          />
        );
      })}

      {/* Labels */}
      {ticks.filter((t) => t.major).map(({ d }) => {
        const px = (d - displayValue) * PPD + SCREEN_W / 2;
        if (px < -40 || px > SCREEN_W + 40) { return null; }
        return (
          <Text
            key={d}
            pointerEvents="none"
            style={[rulerStyles.tickLabel, { left: px - 16 }]}
          >
            {d === 0 ? '0°' : d < 0 ? `${d}°` : `+${d}°`}
          </Text>
        );
      })}

      {/* Fixed centre cursor */}
      <View pointerEvents="none" style={rulerStyles.cursor} />
    </View>
  );
}

const rulerStyles = StyleSheet.create({
  track: {
    height: 64,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  tick: {
    position: 'absolute',
    bottom: 22,
    width: 2,
    borderRadius: 1,
  },
  tickMinor: {
    height: 10,
    backgroundColor: '#444',
  },
  tickMajor: {
    height: 18,
    backgroundColor: '#777',
  },
  tickLabel: {
    position: 'absolute',
    bottom: 4,
    width: 32,
    color: '#555',
    fontSize: 10,
    textAlign: 'center',
  },
  cursor: {
    position: 'absolute',
    top: 4,
    left: SCREEN_W / 2 - 1,
    width: 2,
    height: 56,
    backgroundColor: ACCENT,
    borderRadius: 1,
  },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerTitle: {
    color: dark.text,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: dark.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleBtnAccent: {
    backgroundColor: ACCENT,
  },
  canvas: {
    flex: 1,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  bakingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 10,
  },
  dim: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  cropFrame: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(255,214,10,0.5)',
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  cornerArm: {
    position: 'absolute',
    backgroundColor: ACCENT,
  },
  rotLabel: {
    color: ACCENT,
    fontSize: fontSize.sm,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 6,
    backgroundColor: '#000',
  },
  bottomSheet: {
    backgroundColor: dark.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  flipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  flipLabel: {
    color: dark.text,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: dark.border,
    marginBottom: spacing.xs,
  },
  ratioRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    gap: spacing.md,
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  ratioChip: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minWidth: 52,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  ratioChipActive: {
    borderBottomColor: ACCENT,
  },
  ratioLabel: {
    color: dark.textSecondary,
    fontSize: 11,
    fontWeight: '500',
  },
  ratioLabelActive: {
    color: ACCENT,
    fontWeight: '700',
  },
});
