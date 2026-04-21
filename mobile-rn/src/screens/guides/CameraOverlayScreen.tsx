import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { colors, spacing, borderRadius, fontSize } from '../../config/theme';
import { Guide } from '../../types/guide';
import { getFullImageUrl } from '../../config/api';

type RouteParams = {
  CameraOverlay: { guide: Guide };
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const CameraOverlayScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'CameraOverlay'>>();
  const { guide } = route.params;
  const insets = useSafeAreaInsets();

  const [opacity, setOpacity] = useState(0.5);
  const [isMirrored, setIsMirrored] = useState(false);
  const [showGuide, setShowGuide] = useState(true);

  const guideImageUrl = getFullImageUrl(guide.guideImageUrl);

  const capturePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Please allow camera access');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0]) {
      Alert.alert(
        'Photo Captured',
        'Your photo has been taken. Would you like to save it?',
        [
          { text: 'Discard', style: 'cancel' },
          {
            text: 'Save',
            onPress: () => {
              Alert.alert('Saved', 'Photo saved to gallery');
            },
          },
        ]
      );
    }
  };

  const pickFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Please allow gallery access');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0]) {
      Alert.alert('Photo Selected', 'Compare your photo with the guide');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.cameraPlaceholder}>
        <Ionicons name="camera-outline" size={80} color="rgba(255,255,255,0.3)" />
        <Text style={styles.placeholderText}>Camera Preview</Text>
        <Text style={styles.placeholderSubtext}>
          Tap the button below to take a photo
        </Text>
      </View>

      {showGuide && guideImageUrl && (
        <Image
          source={{ uri: guideImageUrl }}
          style={[
            styles.guideOverlay,
            { opacity },
            isMirrored && styles.mirrored,
          ]}
          resizeMode="contain"
        />
      )}

      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Pose Camera</Text>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowGuide(!showGuide)}
          >
            <Ionicons
              name={showGuide ? 'eye' : 'eye-off'}
              size={24}
              color="#fff"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setIsMirrored(!isMirrored)}
          >
            <Ionicons name="swap-horizontal" size={24} color="#fff" />
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

        <View style={styles.captureRow}>
          <TouchableOpacity style={styles.actionButton} onPress={pickFromGallery}>
            <Ionicons name="images" size={24} color="#fff" />
            <Text style={styles.actionText}>Gallery</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.captureButton} onPress={capturePhoto}>
            <View style={styles.captureInner} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setIsMirrored(!isMirrored)}
          >
            <Ionicons name="camera-reverse" size={24} color="#fff" />
            <Text style={styles.actionText}>Flip</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: fontSize.xl,
    marginTop: spacing.md,
  },
  placeholderSubtext: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: fontSize.md,
    marginTop: spacing.sm,
  },
  guideOverlay: {
    position: 'absolute',
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  mirrored: {
    transform: [{ scaleX: -1 }],
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
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  opacityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
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
  captureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  actionButton: {
    alignItems: 'center',
  },
  actionText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
  },
});
