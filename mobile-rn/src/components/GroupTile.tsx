import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, fontSize } from '../config/theme';
import { SemanticColors } from '../config/theme';
import { useTheme } from '../theme/ThemeContext';

interface GroupTileProps {
  name: string;
  guideCount: number;
  isDefault?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}

export const GroupTile: React.FC<GroupTileProps> = ({
  name,
  guideCount,
  isDefault,
  onPress,
  onLongPress,
}) => {
  const { semantic } = useTheme();
  const styles = useMemo(() => makeStyles(semantic), [semantic]);
  const iconName: React.ComponentProps<typeof Ionicons>['name'] = isDefault
    ? 'folder-open-outline'
    : 'folder-outline';

  return (
    <TouchableOpacity
      style={styles.tile}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.8}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={iconName} size={28} color={semantic.accent} />
      </View>
      <Text style={styles.name} numberOfLines={1}>{name}</Text>
      <Text style={styles.count}>
        {guideCount === 1 ? '1 guide' : `${guideCount} guides`}
      </Text>
    </TouchableOpacity>
  );
};

interface CreateGroupTileProps {
  onPress?: () => void;
}

export const CreateGroupTile: React.FC<CreateGroupTileProps> = ({ onPress }) => {
  const { semantic } = useTheme();
  const styles = useMemo(() => makeStyles(semantic), [semantic]);
  return (
    <TouchableOpacity style={styles.createTile} onPress={onPress} activeOpacity={0.8}>
      <Ionicons name="add" size={32} color={semantic.textSecondary} />
      <Text style={styles.createLabel}>New Group</Text>
    </TouchableOpacity>
  );
};

function makeStyles(s: SemanticColors) {
  return StyleSheet.create({
    tile: {
      flex: 1,
      backgroundColor: s.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      minHeight: 120,
      justifyContent: 'space-between',
    },
    iconWrap: {
      width: 48,
      height: 48,
      borderRadius: borderRadius.md,
      backgroundColor: s.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    name: {
      fontSize: fontSize.md,
      fontWeight: '700',
      color: s.text,
    },
    count: {
      fontSize: fontSize.sm,
      color: s.textSecondary,
      marginTop: 2,
    },
    createTile: {
      flex: 1,
      backgroundColor: 'transparent',
      borderRadius: borderRadius.lg,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: s.border,
      minHeight: 120,
      alignItems: 'center',
      justifyContent: 'center',
    },
    createLabel: {
      fontSize: fontSize.sm,
      color: s.textSecondary,
      fontWeight: '600',
      marginTop: spacing.xs,
    },
  });
}
