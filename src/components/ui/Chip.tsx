import React from 'react';
import {
  TouchableOpacity,
  View,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Text } from './Text';
import { useTheme } from '../../theme/useTheme';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Chip({
  label,
  selected = false,
  onPress,
  disabled = false,
  style,
}: ChipProps) {
  const { theme } = useTheme();

  const backgroundColor = selected
    ? theme.colors.primary
    : theme.colors.surfaceMuted;

  const textColor = selected ? 'inverse' : 'secondary';
  const borderColor = selected ? theme.colors.primary : theme.colors.borderSubtle;

  const content = (
    <Text
      variant="label"
      color={textColor}
      style={[
        styles.label,
        selected && { textTransform: 'none', letterSpacing: 0.3 },
      ]}
    >
      {label}
    </Text>
  );

  if (!onPress) {
    return (
      <View
        style={[
          styles.chip,
          {
            backgroundColor,
            borderColor,
            borderRadius: theme.radius.full,
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.sm,
          },
          style,
        ]}
      >
        {content}
      </View>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={label}
      style={[
        styles.chip,
        {
          backgroundColor: disabled ? theme.colors.disabled : backgroundColor,
          borderColor: disabled ? theme.colors.disabled : borderColor,
          borderRadius: theme.radius.full,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.sm,
          opacity: disabled ? 0.6 : 1,
        },
        style,
      ]}
    >
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: {
    textTransform: 'none',
  },
});
