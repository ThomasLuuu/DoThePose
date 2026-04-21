import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, borderRadius, fontSize } from '../../config/theme';
import { Button } from '../../components/Button';
import { apiClient } from '../../api/client';
import { useGuidesStore } from '../../store/guidesStore';
import { GuideStyle } from '../../types/guide';

type LineStyle = 'portrait_minimal' | 'portrait_moderate';

const STYLE_OPTIONS: { value: LineStyle; label: string }[] = [
  { value: 'portrait_minimal', label: 'Style 1' },
  { value: 'portrait_moderate', label: 'Style 2' },
];

export const UploadScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<LineStyle>('portrait_minimal');
  const [isUploading, setIsUploading] = useState(false);
  const addGuide = useGuidesStore((state) => state.addGuide);

  const pickImage = async (useCamera: boolean) => {
    const permissionResult = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(
        'Permission Required',
        `Please allow access to your ${useCamera ? 'camera' : 'photo library'}`
      );
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.9,
          allowsEditing: true,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.9,
          allowsEditing: true,
        });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const uploadImage = async () => {
    if (!selectedImage) return;

    setIsUploading(true);
    try {
      const guide = await apiClient.uploadImage(selectedImage, undefined, { style: selectedStyle });
      addGuide(guide);
      setSelectedImage(null);
      navigation.navigate('Processing', { guide });
    } catch (error: any) {
      const msg = error.message || 'Please try again';
      const title = msg.includes('longer than expected')
        ? 'Upload Timeout'
        : 'Upload Failed';
      Alert.alert(title, msg);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.content}>
        {selectedImage ? (
          <View style={styles.previewContainer}>
            <Image source={{ uri: selectedImage }} style={styles.preview} />
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setSelectedImage(null)}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.picker}
            onPress={() => pickImage(false)}
          >
            <Ionicons name="add-outline" size={64} color={colors.primary} />
            <Text style={styles.pickerTitle}>Select Reference Image</Text>
            <Text style={styles.pickerSubtitle}>
              Choose a photo with the pose you want to recreate
            </Text>

            <View style={styles.pickerButtons}>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => pickImage(false)}
              >
                <Ionicons name="images-outline" size={24} color={colors.primary} />
                <Text style={styles.pickerButtonText}>Gallery</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => pickImage(true)}
              >
                <Ionicons name="camera-outline" size={24} color={colors.primary} />
                <Text style={styles.pickerButtonText}>Camera</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {selectedImage && (
        <View style={styles.actions}>
          <View style={styles.styleSelector}>
            <Text style={styles.styleSelectorLabel}>Line Style</Text>
            <View style={styles.styleOptions}>
              {STYLE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.styleOption,
                    selectedStyle === option.value && styles.styleOptionSelected,
                  ]}
                  onPress={() => setSelectedStyle(option.value)}
                  disabled={isUploading}
                >
                  <View style={[
                    styles.radioOuter,
                    selectedStyle === option.value && styles.radioOuterSelected,
                  ]}>
                    {selectedStyle === option.value && <View style={styles.radioInner} />}
                  </View>
                  <Text style={[
                    styles.styleOptionText,
                    selectedStyle === option.value && styles.styleOptionTextSelected,
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <Button
            title="Generate Pose Guide"
            onPress={uploadImage}
            loading={isUploading}
            icon={<Ionicons name="sparkles" size={20} color="#fff" />}
          />
          <Button
            title="Choose Different Image"
            variant="outline"
            onPress={() => setSelectedImage(null)}
            disabled={isUploading}
            style={styles.secondaryButton}
          />
        </View>
      )}

      {isUploading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Uploading image...</Text>
          </View>
        </View>
      )}
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
    padding: spacing.lg,
  },
  picker: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surface,
  },
  pickerTitle: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.lg,
  },
  pickerSubtitle: {
    fontSize: fontSize.md,
    color: colors.textLight,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  pickerButtons: {
    flexDirection: 'row',
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.primary}15`,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  pickerButtonText: {
    color: colors.primary,
    fontWeight: '600',
  },
  previewContainer: {
    flex: 1,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  preview: {
    flex: 1,
    resizeMode: 'contain',
    backgroundColor: colors.surface,
  },
  closeButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: borderRadius.full,
    padding: spacing.sm,
  },
  actions: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  styleSelector: {
    marginBottom: spacing.md,
  },
  styleSelectorLabel: {
    fontSize: fontSize.sm,
    color: colors.textLight,
    marginBottom: spacing.sm,
  },
  styleOptions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  styleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  styleOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}10`,
  },
  styleOptionText: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  styleOptionTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    marginTop: spacing.sm,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingCard: {
    backgroundColor: colors.surface,
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.text,
    fontSize: fontSize.md,
  },
});
