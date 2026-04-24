import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, fontSize } from '../config/theme';
import { SemanticColors } from '../config/theme';
import { Group, MAX_GROUP_NAME_LENGTH } from '../types/group';
import { TextInputModal } from './TextInputModal';
import { useTheme } from '../theme/ThemeContext';

interface AddToGroupModalProps {
  visible: boolean;
  groups: Group[];
  excludeGroupId?: string;
  onClose: () => void;
  onPick: (groupId: string) => void | Promise<void>;
  onCreate: (name: string) => Promise<Group | null>;
  busy?: boolean;
}

export const AddToGroupModal: React.FC<AddToGroupModalProps> = ({
  visible,
  groups,
  excludeGroupId,
  onClose,
  onPick,
  onCreate,
  busy,
}) => {
  const { semantic } = useTheme();
  const styles = useMemo(() => makeStyles(semantic), [semantic]);
  const [createOpen, setCreateOpen] = useState(false);

  const available = useMemo(
    () => groups.filter((g) => g.id !== excludeGroupId),
    [groups, excludeGroupId],
  );

  const handleCreate = async (name: string) => {
    const created = await onCreate(name);
    setCreateOpen(false);
    if (created) {
      await onPick(created.id);
    }
  };

  return (
    <>
      <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.title}>Add to Group</Text>
              <TouchableOpacity onPress={onClose} accessibilityLabel="Close">
                <Ionicons name="close" size={22} color={semantic.textSecondary} />
              </TouchableOpacity>
            </View>
            {busy ? (
              <View style={styles.center}>
                <ActivityIndicator color={semantic.primary} />
              </View>
            ) : (
              <FlatList
                data={available}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={
                  <TouchableOpacity
                    style={styles.row}
                    onPress={() => setCreateOpen(true)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.iconWrap}>
                      <Ionicons name="add" size={20} color={semantic.accent} />
                    </View>
                    <Text style={styles.rowText}>New Group…</Text>
                  </TouchableOpacity>
                }
                ListEmptyComponent={
                  <Text style={styles.empty}>No other groups yet. Create one above.</Text>
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.row}
                    onPress={() => onPick(item.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.iconWrap}>
                      <Ionicons name="folder-outline" size={20} color={semantic.accent} />
                    </View>
                    <Text style={styles.rowText} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.rowCount}>
                      {item.guideCount === 1 ? '1' : item.guideCount}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
      <TextInputModal
        visible={createOpen}
        title="New Group"
        placeholder="Group name"
        confirmLabel="Create"
        maxLength={MAX_GROUP_NAME_LENGTH}
        onCancel={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />
    </>
  );
};

function makeStyles(s: SemanticColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    card: {
      backgroundColor: s.surface,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.lg,
      paddingHorizontal: spacing.lg,
      maxHeight: '70%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    title: {
      fontSize: fontSize.lg,
      fontWeight: '700',
      color: s.text,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      gap: spacing.md,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.sm,
      backgroundColor: s.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowText: {
      flex: 1,
      fontSize: fontSize.md,
      color: s.text,
      fontWeight: '500',
    },
    rowCount: {
      fontSize: fontSize.sm,
      color: s.textSecondary,
    },
    empty: {
      textAlign: 'center',
      color: s.textSecondary,
      fontSize: fontSize.sm,
      marginTop: spacing.lg,
    },
    center: {
      paddingVertical: spacing.xxl,
      alignItems: 'center',
    },
  });
}
