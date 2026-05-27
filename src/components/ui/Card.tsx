import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { useTheme } from '../../theme/useTheme';

interface CardProps extends ViewProps {
  elevated?: boolean;
  muted?: boolean;
}

export function Card({
  children,
  style,
  elevated = false,
  muted = false,
  ...rest
}: CardProps) {
  const { theme } = useTheme();

  const backgroundColor = muted
    ? theme.colors.surfaceMuted
    : theme.colors.surface;

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor,
          borderColor: theme.colors.borderSubtle,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.lg,
        },
        elevated && theme.shadows.md,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});
