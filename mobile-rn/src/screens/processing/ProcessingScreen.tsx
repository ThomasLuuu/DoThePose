import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Animated,
  TouchableOpacity,
  LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { colors, dark, spacing, borderRadius, fontSize } from '../../config/theme';
import { Button } from '../../components/Button';
import { Guide } from '../../types/guide';
import { apiClient } from '../../api/client';
import { useGuidesStore } from '../../store/guidesStore';
import { getFullImageUrl } from '../../config/api';

type RouteParams = {
  Processing: { guide: Guide };
};

const POLL_INTERVAL_MS = 2500;
const MAX_PROCESSING_MS = 5 * 60 * 1000;
const GRID_DIVS = 7;
const BRACKET_LEN = 22;
const BRACKET_THICK = 2;
const CROSS_STROKE = 2;
const PREVIEW_RADIUS = borderRadius.lg;

function syntheticProgressPercent(elapsedSec: number, status: Guide['status']): number {
  const rate = status === 'processing' ? 1.15 : 0.42;
  return Math.min(92, Math.round(8 + elapsedSec * rate));
}

export const ProcessingScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'Processing'>>();
  const { guide: initialGuide } = route.params;

  const [guide, setGuide] = useState<Guide>(initialGuide);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [previewHeight, setPreviewHeight] = useState(0);
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollingRef = useRef(false);
  const mountedRef = useRef(true);
  const startTimeRef = useRef(Date.now());
  const guideIdRef = useRef(guide.id);
  const scanAnim = useRef(new Animated.Value(0)).current;
  const updateGuideInList = useGuidesStore((state) => state.updateGuideInList);
  const navigationRef = useRef(navigation);
  const updateGuideInListRef = useRef(updateGuideInList);

  guideIdRef.current = guide.id;
  navigationRef.current = navigation;
  updateGuideInListRef.current = updateGuideInList;

  const stopPolling = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    startTimeRef.current = Date.now();

    const checkStatus = async () => {
      if (!mountedRef.current || pollingRef.current) {
        return;
      }

      if (Date.now() - startTimeRef.current > MAX_PROCESSING_MS) {
        setHasError(true);
        setErrorMessage('Processing is taking too long. Please try again with a smaller image.');
        stopPolling();
        return;
      }

      pollingRef.current = true;
      try {
        const updated = await apiClient.getGuide(guideIdRef.current);
        if (!mountedRef.current) {
          return;
        }
        setGuide(updated);
        updateGuideInListRef.current(updated);

        if (updated.status === 'completed') {
          stopPolling();
          navigationRef.current.replace('EditGuide', { guide: updated });
        } else if (updated.status === 'failed') {
          stopPolling();
          setHasError(true);
          setErrorMessage(updated.processingError || 'Processing failed');
        } else {
          stopPolling();
          if (mountedRef.current) {
            pollTimeoutRef.current = setTimeout(checkStatus, POLL_INTERVAL_MS);
          }
        }
      } catch (error: any) {
        if (!mountedRef.current) {
          return;
        }
        stopPolling();
        setHasError(true);
        setErrorMessage(error.message || 'Failed to check status');
      } finally {
        pollingRef.current = false;
      }
    };

    checkStatus();

    const tickInterval = setInterval(() => {
      if (mountedRef.current) {
        setElapsedSec(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }
    }, 1000);

    return () => {
      mountedRef.current = false;
      stopPolling();
      clearInterval(tickInterval);
    };
  }, [stopPolling]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, {
          toValue: 1,
          duration: 2800,
          useNativeDriver: true,
        }),
        Animated.timing(scanAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    if (!hasError) {
      loop.start();
    }
    return () => loop.stop();
  }, [hasError, scanAnim]);

  const onPreviewLayout = (e: LayoutChangeEvent) => {
    setPreviewHeight(e.nativeEvent.layout.height);
  };

  const scanTranslate =
    previewHeight > 0
      ? scanAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.max(0, previewHeight - 3)],
        })
      : 0;

  const primaryStatusLine = () => {
    switch (guide.status) {
      case 'pending':
        return 'Preparing analysis...';
      case 'processing':
        return 'Extracting Pose...';
      default:
        return 'Working...';
    }
  };

  const secondaryStatusLine = () => {
    switch (guide.status) {
      case 'pending':
        return 'Your image is in the queue';
      case 'processing':
        return 'Identifying skeleton joints and body contours';
      default:
        return '';
    }
  };

  const progressPct = syntheticProgressPercent(elapsedSec, guide.status);
  const sourceUri = getFullImageUrl(guide.sourceImageUrl);

  const gridLinesH = Array.from({ length: GRID_DIVS }, (_, i) => i);
  const gridLinesV = Array.from({ length: GRID_DIVS }, (_, i) => i);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.screenTitle}>AI ANALYSIS</Text>

      <View style={styles.body}>
        {hasError ? (
          <View style={styles.errorBlock}>
            <Ionicons name="alert-circle-outline" size={72} color={colors.error} />
            <Text style={styles.errorTitle}>Processing Failed</Text>
            <Text style={styles.errorSubtitle}>{errorMessage}</Text>
            <Button
              title="Try Again"
              onPress={() => navigation.goBack()}
              icon={<Ionicons name="refresh" size={20} color="#fff" />}
              style={styles.errorButton}
            />
          </View>
        ) : (
          <>
            <View style={styles.previewWrap} onLayout={onPreviewLayout}>
              {sourceUri ? (
                <Image source={{ uri: sourceUri }} style={styles.previewImage} resizeMode="cover" />
              ) : (
                <View style={styles.previewPlaceholder} />
              )}

              <View style={styles.gridOverlay} pointerEvents="none">
                {gridLinesH.map((i) => (
                  <View
                    key={`h-${i}`}
                    style={[
                      styles.gridLineH,
                      { top: `${((i + 1) / (GRID_DIVS + 1)) * 100}%` },
                    ]}
                  />
                ))}
                {gridLinesV.map((i) => (
                  <View
                    key={`v-${i}`}
                    style={[
                      styles.gridLineV,
                      { left: `${((i + 1) / (GRID_DIVS + 1)) * 100}%` },
                    ]}
                  />
                ))}
              </View>

              <View style={[styles.corner, styles.cornerTL]} pointerEvents="none" />
              <View style={[styles.corner, styles.cornerTR]} pointerEvents="none" />
              <View style={[styles.corner, styles.cornerBL]} pointerEvents="none" />
              <View style={[styles.corner, styles.cornerBR]} pointerEvents="none" />

              <View style={styles.poseOverlay} pointerEvents="none">
                <View style={styles.poseCrossV} />
                <View style={styles.poseCrossH} />
                <View style={[styles.poseDot, styles.poseDotLeft]} />
                <View style={[styles.poseDot, styles.poseDotMid]} />
                <View style={[styles.poseDot, styles.poseDotRight]} />
              </View>

              {previewHeight > 0 && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.scanLine,
                    { transform: [{ translateY: scanTranslate }] },
                  ]}
                />
              )}
            </View>

            <Text style={styles.primaryStatus}>{primaryStatusLine()}</Text>
            <Text style={styles.secondaryStatus}>{secondaryStatusLine()}</Text>

            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>PROCESSING</Text>
              <Text style={styles.progressPercent}>{progressPct}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
            </View>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.75}
            >
              <Ionicons name="close" size={20} color={dark.text} />
              <Text style={styles.cancelButtonText}>Cancel Analysis</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: dark.background,
  },
  screenTitle: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    textAlign: 'center',
    fontSize: fontSize.xs,
    letterSpacing: 2,
    fontWeight: '600',
    color: dark.textSecondary,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  previewWrap: {
    flex: 1,
    minHeight: 200,
    borderRadius: PREVIEW_RADIUS,
    overflow: 'hidden',
    backgroundColor: dark.surface,
  },
  previewImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  previewPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: dark.surfaceMuted,
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  corner: {
    position: 'absolute',
    width: BRACKET_LEN,
    height: BRACKET_LEN,
    borderColor: dark.accent,
  },
  cornerTL: {
    top: spacing.md,
    left: spacing.md,
    borderTopWidth: BRACKET_THICK,
    borderLeftWidth: BRACKET_THICK,
  },
  cornerTR: {
    top: spacing.md,
    right: spacing.md,
    borderTopWidth: BRACKET_THICK,
    borderRightWidth: BRACKET_THICK,
  },
  cornerBL: {
    bottom: spacing.md,
    left: spacing.md,
    borderBottomWidth: BRACKET_THICK,
    borderLeftWidth: BRACKET_THICK,
  },
  cornerBR: {
    bottom: spacing.md,
    right: spacing.md,
    borderBottomWidth: BRACKET_THICK,
    borderRightWidth: BRACKET_THICK,
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 2,
    backgroundColor: dark.accent,
  },
  poseOverlay: {
    position: 'absolute',
    left: '34%',
    width: '32%',
    top: '22%',
    height: '36%',
  },
  poseCrossV: {
    position: 'absolute',
    left: '50%',
    marginLeft: -CROSS_STROKE / 2,
    top: 0,
    bottom: 0,
    width: CROSS_STROKE,
    backgroundColor: dark.accent,
    opacity: 0.95,
  },
  poseCrossH: {
    position: 'absolute',
    top: '50%',
    marginTop: -CROSS_STROKE / 2,
    left: '12%',
    right: '12%',
    height: CROSS_STROKE,
    backgroundColor: dark.accent,
    opacity: 0.95,
  },
  poseDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: dark.accent,
    top: '50%',
    marginTop: -4,
  },
  poseDotLeft: {
    left: '12%',
    marginLeft: -4,
  },
  poseDotMid: {
    left: '50%',
    marginLeft: -4,
  },
  poseDotRight: {
    right: '12%',
    marginRight: -4,
  },
  primaryStatus: {
    marginTop: spacing.lg,
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: dark.text,
  },
  secondaryStatus: {
    marginTop: spacing.sm,
    fontSize: fontSize.sm,
    color: dark.textSecondary,
    lineHeight: 20,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.xs,
  },
  progressLabel: {
    fontSize: fontSize.xs,
    letterSpacing: 1.2,
    fontWeight: '600',
    color: dark.textSecondary,
  },
  progressPercent: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: dark.accent,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: dark.surfaceMuted,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: dark.accent,
    borderRadius: 2,
  },
  cancelButton: {
    marginTop: spacing.xl,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: dark.surface,
  },
  cancelButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: dark.text,
  },
  errorBlock: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  errorTitle: {
    marginTop: spacing.lg,
    fontSize: fontSize.xxl,
    fontWeight: '600',
    color: dark.text,
    textAlign: 'center',
  },
  errorSubtitle: {
    marginTop: spacing.sm,
    fontSize: fontSize.md,
    color: dark.textSecondary,
    textAlign: 'center',
  },
  errorButton: {
    marginTop: spacing.xl,
  },
});
