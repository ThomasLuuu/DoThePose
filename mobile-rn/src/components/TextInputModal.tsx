import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { dark, spacing, borderRadius, fontSize } from '../config/theme';

interface TextInputModalProps {
  visible: boolean;
  title: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  maxLength?: number;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}

export const TextInputModal: React.FC<TextInputModalProps> = ({
  visible,
  title,
  placeholder,
  initialValue = '',
  confirmLabel = 'Save',
  cancelLabel = 'Cancel',
  maxLength = 120,
  onCancel,
  onSubmit,
}) => {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (visible) {
      setValue(initialValue);
    }
  }, [visible, initialValue]);

  const trimmed = value.trim();
  const canSubmit = trimmed.length > 0;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor={dark.textSecondary}
            style={styles.input}
            autoFocus
            maxLength={maxLength}
            returnKeyType="done"
            onSubmitEditing={() => { if (canSubmit) { onSubmit(trimmed); } }}
          />
          <View style={styles.actions}>
            <TouchableOpacity onPress={onCancel} style={styles.button}>
              <Text style={styles.buttonText}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { if (canSubmit) { onSubmit(trimmed); } }}
              style={styles.button}
              disabled={!canSubmit}
            >
              <Text style={[styles.buttonText, styles.primary, !canSubmit && styles.disabled]}>
                {confirmLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: dark.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: dark.text,
    marginBottom: spacing.md,
  },
  input: {
    backgroundColor: dark.surfaceMuted,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: dark.text,
    fontSize: fontSize.md,
    marginBottom: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  button: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  buttonText: {
    fontSize: fontSize.md,
    color: dark.textSecondary,
    fontWeight: '600',
  },
  primary: {
    color: dark.accent,
  },
  disabled: {
    opacity: 0.4,
  },
});
