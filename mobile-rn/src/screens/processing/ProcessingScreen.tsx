import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { colors, spacing, borderRadius, fontSize } from '../../config/theme';
import { Button } from '../../components/Button';
import { Guide } from '../../types/guide';
import { apiClient } from '../../api/client';
import { useGuidesStore } from '../../store/guidesStore';

type RouteParams = {
  Processing: { guide: Guide };
};

const POLL_INTERVAL_MS = 2500;
const MAX_PROCESSING_MS = 5 * 60 * 1000;

export const ProcessingScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'Processing'>>();
  const { guide: initialGuide } = route.params;

  const [guide, setGuide] = useState<Guide>(initialGuide);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [elapsedSec, setElapsedSec] = useState(0);
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollingRef = useRef(false);
  const mountedRef = useRef(true);
  const startTimeRef = useRef(Date.now());
  const updateGuideInList = useGuidesStore((state) => state.updateGuideInList);

  const stopPolling = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  const scheduleNextPoll = useCallback(() => {
    stopPolling();
    if (mountedRef.current) {
      pollTimeoutRef.current = setTimeout(checkStatus, POLL_INTERVAL_MS);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    startTimeRef.current = Date.now();
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
  }, []);

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
      const updated = await apiClient.getGuide(guide.id);
      if (!mountedRef.current) {
        return;
      }
      setGuide(updated);
      updateGuideInList(updated);

      if (updated.status === 'completed') {
        stopPolling();
        navigation.replace('GuideViewer', { guide: updated });
      } else if (updated.status === 'failed') {
        stopPolling();
        setHasError(true);
        setErrorMessage(updated.processingError || 'Processing failed');
      } else {
        scheduleNextPoll();
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

  const getStatusText = () => {
    switch (guide.status) {
      case 'pending':
        return 'Queued';
      case 'processing':
        return 'Processing';
      case 'completed':
        return 'Complete';
      case 'failed':
        return 'Failed';
      default:
        return 'Unknown';
    }
  };

  const formatElapsed = (sec: number) => {
    if (sec < 60) {
      return `${sec}s`;
    }
    return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  };

  const getStatusDescription = () => {
    switch (guide.status) {
      case 'pending':
        return `Your image is in the queue... (${formatElapsed(elapsedSec)})`;
      case 'processing':
        return `Extracting pose, detecting composition, and rendering your guide... (${formatElapsed(elapsedSec)})`;
      case 'completed':
        return 'Your pose guide is ready!';
      case 'failed':
        return guide.processingError || 'Processing failed';
      default:
        return '';
    }
  };

  const steps = [
    { label: 'Upload', completed: true },
    { label: 'Analyze', completed: guide.status !== 'pending' },
    { label: 'Render', completed: guide.status === 'completed' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {hasError ? (
          <>
            <Ionicons name="alert-circle-outline" size={80} color={colors.error} />
            <Text style={styles.title}>Processing Failed</Text>
            <Text style={styles.subtitle}>{errorMessage}</Text>
            <Button
              title="Try Again"
              onPress={() => navigation.goBack()}
              icon={<Ionicons name="refresh" size={20} color="#fff" />}
              style={styles.button}
            />
          </>
        ) : (
          <>
            <View style={styles.spinner}>
              <Ionicons name="sync" size={60} color={colors.primary} />
            </View>
            <Text style={styles.title}>{getStatusText()}</Text>
            <Text style={styles.subtitle}>{getStatusDescription()}</Text>

            <View style={styles.progress}>
              {steps.map((step, index) => (
                <React.Fragment key={step.label}>
                  {index > 0 && (
                    <View
                      style={[
                        styles.progressLine,
                        step.completed && styles.progressLineActive,
                      ]}
                    />
                  )}
                  <View style={styles.progressStep}>
                    <View
                      style={[
                        styles.progressDot,
                        step.completed && styles.progressDotActive,
                      ]}
                    >
                      {step.completed ? (
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      ) : (
                        <Text style={styles.progressNumber}>{index + 1}</Text>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.progressLabel,
                        step.completed && styles.progressLabelActive,
                      ]}
                    >
                      {step.label}
                    </Text>
                  </View>
                </React.Fragment>
              ))}
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  spinner: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textLight,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  button: {
    marginTop: spacing.lg,
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  progressStep: {
    alignItems: 'center',
  },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: colors.border,
    marginHorizontal: spacing.xs,
  },
  progressLineActive: {
    backgroundColor: colors.primary,
  },
  progressDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressDotActive: {
    backgroundColor: colors.primary,
  },
  progressNumber: {
    color: colors.textLight,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  progressLabel: {
    marginTop: spacing.xs,
    fontSize: fontSize.xs,
    color: colors.textLight,
  },
  progressLabelActive: {
    color: colors.primary,
  },
});
