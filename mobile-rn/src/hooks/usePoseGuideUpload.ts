import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { apiClient } from '../api/client';
import { useGuidesStore } from '../store/guidesStore';

export type LineStyle = 'portrait_minimal' | 'portrait_moderate';

export function usePoseGuideUpload() {
  const navigation = useNavigation<any>();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<LineStyle>('portrait_minimal');
  const [isUploading, setIsUploading] = useState(false);
  const addGuide = useGuidesStore((state) => state.addGuide);

  const pickImage = useCallback(async (useCamera: boolean) => {
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
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedImage(null);
  }, []);

  const uploadImage = useCallback(async () => {
    if (!selectedImage) {
      return;
    }

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
  }, [selectedImage, selectedStyle, addGuide, navigation]);

  const selectImageUri = useCallback((uri: string) => {
    setSelectedImage(uri);
  }, []);

  return {
    selectedImage,
    selectedStyle,
    setSelectedStyle,
    isUploading,
    pickImage,
    selectImageUri,
    clearSelection,
    uploadImage,
  };
}
