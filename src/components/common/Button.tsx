import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '../../theme/useTheme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
}) => {
  const { theme } = useTheme();
  const isDisabled = disabled || loading;

  const containerStyle: ViewStyle = {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing['2xl'],
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: theme.spacing['4xl'],
    width: fullWidth ? '100%' : undefined,
  };

  let backgroundColor = theme.colors.primary;
  let borderColor = 'transparent';
  let borderWidth = 0;

  if (isDisabled) {
    backgroundColor =
      variant === 'outline' ? 'transparent' : theme.colors.disabled;
    borderColor = variant === 'outline' ? theme.colors.disabled : 'transparent';
    borderWidth = variant === 'outline' ? 2 : 0;
  } else if (variant === 'secondary') {
    backgroundColor = theme.colors.accent;
  } else if (variant === 'outline') {
    backgroundColor = 'transparent';
    borderColor = theme.colors.primary;
    borderWidth = 2;
  }

  const textStyle: TextStyle = {
    ...theme.typography.body,
    fontWeight: theme.typography.label.fontWeight,
    color:
      variant === 'outline' && !isDisabled
        ? theme.colors.primary
        : isDisabled
          ? theme.colors.disabledText
          : theme.colors.textInverse,
  };

  const spinnerColor =
    variant === 'outline' && !isDisabled
      ? theme.colors.primary
      : theme.colors.textInverse;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled }}
      style={[
        containerStyle,
        { backgroundColor, borderColor, borderWidth },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <Text style={textStyle}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};
