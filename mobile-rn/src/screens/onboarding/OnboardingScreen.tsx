import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  ImageSourcePropType,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  TouchableOpacity,
  ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { dark, spacing, fontSize, borderRadius } from '../../config/theme';
import { useOnboardingStore } from '../../store/onboardingStore';

const { width: SCREEN_W } = Dimensions.get('window');

type Slide = {
  key: string;
  title: string;
  subtitle: string;
  image?: ImageSourcePropType;
  hero?: 'upload' | 'ai-extract';
};

const SLIDES: Slide[] = [
  {
    key: '1',
    title: 'Upload Reference',
    subtitle:
      'Found a pose you love? Upload any photo from your gallery to use as your posing guide.',
    hero: 'upload',
  },
  {
    key: '2',
    title: 'AI Extraction',
    subtitle:
      'Our AI instantly analyzes the image and extracts the perfect skeleton or outline guide.',
    hero: 'ai-extract',
  },
  {
    key: '3',
    title: 'Align Yourself',
    subtitle:
      'Step into the frame and match your body with the glowing neon overlay on your screen.',
    image: require('../../../assets/onboarding/align_self.png'),
  },
  {
    key: '4',
    title: 'Perfect Match',
    subtitle:
      'Get real-time guidance until you hit the perfect pose, then automatically capture the shot.',
    image: require('../../../assets/onboarding/perfect_match.png'),
  },
];

const UploadHero: React.FC = () => {
  return (
    <View style={styles.uploadHero}>
      <View style={[styles.uploadCard, styles.uploadCardBackLeft]} />
      <View style={[styles.uploadCard, styles.uploadCardBackRight]} />
      <View style={[styles.uploadCard, styles.uploadCardFront]}>
        <View style={styles.uploadBadge}>
          <Ionicons name="arrow-up" size={36} color="#000" />
        </View>
      </View>
    </View>
  );
};

const AIExtractionHero: React.FC = () => {
  return (
    <View style={styles.aiHeroWrap}>
      <Image
        source={require('../../../assets/onboarding/ai_extraction_hero.png')}
        style={styles.aiHeroImage}
        resizeMode="contain"
      />
    </View>
  );
};

export const OnboardingScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const completeOnboarding = useOnboardingStore((s) => s.completeOnboarding);
  const listRef = useRef<FlatList<Slide>>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const goMain = useCallback(() => {
    completeOnboarding();
    navigation.replace('Main');
  }, [completeOnboarding, navigation]);

  const onScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const next = Math.round(x / SCREEN_W);
    setActiveIndex(Math.min(Math.max(next, 0), SLIDES.length - 1));
  }, []);

  const goNext = useCallback(() => {
    if (activeIndex >= SLIDES.length - 1) {
      return;
    }
    listRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
  }, [activeIndex]);

  const renderSlide = useCallback(
    ({ item }: ListRenderItemInfo<Slide>) => (
      <View style={[styles.slide, { width: SCREEN_W }]}>
        <View style={styles.heroWrap}>
          {item.hero === 'upload' ? (
            <UploadHero />
          ) : item.hero === 'ai-extract' ? (
            <AIExtractionHero />
          ) : item.image ? (
            <Image source={item.image} style={styles.heroImage} resizeMode="contain" />
          ) : null}
        </View>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.subtitle}>{item.subtitle}</Text>
      </View>
    ),
    [],
  );

  const isLast = activeIndex === SLIDES.length - 1;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <FlatList
        ref={listRef}
        style={styles.list}
        data={SLIDES}
        keyExtractor={(item) => item.key}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onMomentumScrollEnd={onScrollEnd}
        getItemLayout={(_, index) => ({
          length: SCREEN_W,
          offset: SCREEN_W * index,
          index,
        })}
      />

      <View style={styles.footer} pointerEvents="box-none">
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <View
              key={s.key}
              style={[styles.dot, i === activeIndex ? styles.dotActive : styles.dotInactive]}
            />
          ))}
        </View>

        {isLast ? (
          <View style={styles.lastActions}>
            <TouchableOpacity
              style={styles.getStartedBtn}
              onPress={goMain}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Get started"
            >
              <Text style={styles.getStartedText}>Get Started</Text>
              <Ionicons name="sparkles" size={20} color="#000" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.rowActions}>
            <TouchableOpacity onPress={goMain} hitSlop={12} accessibilityRole="button">
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.nextBtn}
              onPress={goNext}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Next"
            >
              <Text style={styles.nextText}>Next</Text>
              <Text style={styles.nextArrow}>→</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: dark.background,
  },
  list: {
    flex: 1,
  },
  slide: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: 168,
  },
  heroWrap: {
    flex: 1,
    minHeight: 280,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  uploadHero: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadCard: {
    position: 'absolute',
    width: 220,
    height: 300,
    borderRadius: 28,
    backgroundColor: '#1A1A1A',
  },
  uploadCardBackLeft: {
    transform: [{ rotate: '-12deg' }, { translateX: -24 }, { translateY: 12 }],
    backgroundColor: '#1F1F1F',
  },
  uploadCardBackRight: {
    transform: [{ rotate: '10deg' }, { translateX: 24 }, { translateY: 18 }],
    backgroundColor: '#242424',
  },
  uploadCardFront: {
    backgroundColor: '#0A0A0A',
    borderWidth: 3,
    borderColor: '#D7F54A',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '4deg' }],
  },
  uploadBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#D7F54A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiHeroWrap: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiHeroImage: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: dark.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.md,
    lineHeight: 22,
    color: dark.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: dark.background,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 28,
    backgroundColor: dark.accent,
  },
  dotInactive: {
    width: 8,
    backgroundColor: dark.surfaceMuted,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastActions: {
    gap: spacing.md,
  },
  skipLast: {
    alignSelf: 'flex-start',
  },
  skipText: {
    fontSize: fontSize.md,
    color: dark.textSecondary,
    fontWeight: '500',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: dark.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  nextText: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: '#000',
  },
  nextArrow: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: '#000',
  },
  getStartedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: dark.accent,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.full,
    gap: spacing.sm,
  },
  getStartedText: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: '#000',
  },
});
