import React from 'react';
import { Text as RNText, TextProps as RNTextProps } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { TypographyVariant } from '../../theme/typography';
import { ColorPalette } from '../../theme/colors';

type TextColor = 'primary' | 'secondary' | 'muted' | 'inverse' | 'accent' | 'error' | 'success';

interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  color?: TextColor;
}

const COLOR_MAP: Record<TextColor, keyof ColorPalette> = {
  primary: 'text',
  secondary: 'textSecondary',
  muted: 'textMuted',
  inverse: 'textInverse',
  accent: 'accent',
  error: 'error',
  success: 'success',
};

export function Text({
  variant = 'body',
  color = 'primary',
  style,
  children,
  ...rest
}: TextProps) {
  const { theme } = useTheme();
  const variantStyle = theme.typography[variant];
  const colorKey = COLOR_MAP[color];

  return (
    <RNText
      style={[variantStyle, { color: theme.colors[colorKey] }, style]}
      {...rest}
    >
      {children}
    </RNText>
  );
}
