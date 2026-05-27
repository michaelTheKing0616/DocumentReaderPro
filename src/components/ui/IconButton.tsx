import React from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/useTheme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface IconButtonProps {
  icon: IconName;
  onPress: () => void;
  size?: number;
  color?: string;
  accessibilityLabel: string;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'default' | 'filled' | 'ghost';
  style?: ViewStyle;
}

export function IconButton({
  icon,
  onPress,
  size = 22,
  color,
  accessibilityLabel,
  disabled = false,
  loading = false,
  variant = 'default',
  style,
}: IconButtonProps) {
  const { theme } = useTheme();

  const iconColor =
    color ??
    (disabled
      ? theme.colors.disabledText
      : variant === 'filled'
        ? theme.colors.textInverse
        : theme.colors.primary);

  const backgroundColor =
    variant === 'filled'
      ? theme.colors.primary
      : variant === 'ghost'
        ? 'transparent'
        : theme.colors.surfaceMuted;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: disabled || loading }}
      activeOpacity={0.7}
      style={[
        styles.button,
        {
          backgroundColor,
          borderRadius: theme.radius.full,
          minWidth: theme.spacing['4xl'],
          minHeight: theme.spacing['4xl'],
          borderColor: variant === 'default' ? theme.colors.borderSubtle : 'transparent',
        },
        variant === 'default' && styles.bordered,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={iconColor} />
      ) : (
        <Ionicons name={icon} size={size} color={iconColor} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bordered: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});
