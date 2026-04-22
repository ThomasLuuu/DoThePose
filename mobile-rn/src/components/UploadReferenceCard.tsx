import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { dark, spacing, borderRadius, fontSize } from '../config/theme';
import { Button } from './Button';
import { LineStyle } from '../hooks/usePoseGuideUpload';

const STYLE_OPTIONS: { value: LineStyle; label: string }[] = [
  { value: 'portrait_minimal', label: 'Style 1' },
  { value: 'portrait_moderate', label: 'Style 2' },
];

interface UploadReferenceCardProps {
  selectedImage: string | null;
  selectedStyle: LineStyle;
  onStyleChange: (style: LineStyle) => void;
  isUploading: boolean;
  onPickGallery: () => void;
  onPickCamera: () => void;
  onClearSelection: () => void;
  onUpload: () => void;
}

export const UploadReferenceCard: React.FC<UploadReferenceCardProps> = ({
  selectedImage,
  selectedStyle,
  onStyleChange,
  isUploading,
  onPickGallery,
  onPickCamera,
  onClearSelection,
  onUpload,
}) => {
  return (
    <View style={styles.wrap}>
      {selectedImage ? (
        <View style={styles.previewBlock}>
          <View style={styles.previewContainer}>
            <Image source={{ uri: selectedImage }} style={styles.preview} />
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClearSelection}
              disabled={isUploading}
            >
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
            {isUploading ? (
              <View style={styles.uploadOverlay}>
                <ActivityIndicator size="large" color={dark.primary} />
                <Text style={styles.uploadOverlayText}>Uploading image…</Text>
              </View>
            ) : null}
          </View>
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
                  onPress={() => onStyleChange(option.value)}
                  disabled={isUploading}
                >
                  <View
                    style={[
                      styles.radioOuter,
                      selectedStyle === option.value && styles.radioOuterSelected,
                    ]}
                  >
                    {selectedStyle === option.value ? (
                      <View style={styles.radioInner} />
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.styleOptionText,
                      selectedStyle === option.value && styles.styleOptionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <Button
            title="Generate Pose Guide"
            onPress={onUpload}
            loading={isUploading}
            tone="dark"
            icon={<Ionicons name="sparkles" size={20} color="#fff" />}
          />
          <Button
            title="Choose Different Image"
            variant="outline"
            tone="dark"
            onPress={onClearSelection}
            disabled={isUploading}
            style={styles.secondaryButton}
          />
        </View>
      ) : (
        <TouchableOpacity
          style={styles.picker}
          onPress={onPickGallery}
          activeOpacity={0.85}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="images-outline" size={28} color={dark.accent} />
            <View style={styles.plusBadge}>
              <Ionicons name="add" size={14} color={dark.background} />
            </View>
          </View>
          <Text style={styles.pickerTitle}>Upload Reference</Text>
          <Text style={styles.pickerSubtitle}>Choose photo from gallery</Text>
          <View style={styles.pickerButtons}>
            <TouchableOpacity style={styles.pickerButton} onPress={onPickGallery}>
              <Ionicons name="images-outline" size={20} color={dark.accent} />
              <Text style={styles.pickerButtonText}>Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.pickerButton} onPress={onPickCamera}>
              <Ionicons name="camera-outline" size={20} color={dark.accent} />
              <Text style={styles.pickerButtonText}>Camera</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.lg,
  },
  picker: {
    minHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: dark.border,
    borderStyle: 'dashed',
    borderRadius: borderRadius.xl,
    backgroundColor: dark.surface,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: dark.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  plusBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: dark.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: dark.text,
  },
  pickerSubtitle: {
    fontSize: fontSize.sm,
    color: dark.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  pickerButtons: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: dark.surfaceMuted,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  pickerButtonText: {
    color: dark.accent,
    fontWeight: '600',
    fontSize: fontSize.sm,
  },
  previewBlock: {
    gap: spacing.md,
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
  },
  uploadOverlayText: {
    marginTop: spacing.md,
    color: dark.text,
    fontSize: fontSize.md,
  },
  previewContainer: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    minHeight: 200,
    backgroundColor: dark.surfaceMuted,
    position: 'relative',
  },
  preview: {
    width: '100%',
    minHeight: 200,
    resizeMode: 'contain',
  },
  closeButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: borderRadius.full,
    padding: spacing.sm,
  },
  styleSelector: {
    marginTop: spacing.sm,
  },
  styleSelectorLabel: {
    fontSize: fontSize.sm,
    color: dark.textSecondary,
    marginBottom: spacing.sm,
  },
  styleOptions: {
    flexDirection: 'row',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  styleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: dark.surfaceMuted,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: dark.border,
    gap: spacing.sm,
  },
  styleOptionSelected: {
    borderColor: dark.primary,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  styleOptionText: {
    fontSize: fontSize.md,
    color: dark.textSecondary,
  },
  styleOptionTextSelected: {
    color: dark.text,
    fontWeight: '600',
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: dark.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: dark.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: dark.primary,
  },
  secondaryButton: {
    marginTop: spacing.xs,
  },
});
