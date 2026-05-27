import { TextStyle } from 'react-native';

export const fontWeights = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

/** Generous line heights support dyslexia-friendly readability. */
export const typography = {
  display: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: fontWeights.bold,
    letterSpacing: 0.2,
  },
  title: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: fontWeights.semibold,
    letterSpacing: 0.15,
  },
  body: {
    fontSize: 17,
    lineHeight: 28,
    fontWeight: fontWeights.regular,
    letterSpacing: 0.3,
  },
  caption: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: fontWeights.regular,
    letterSpacing: 0.2,
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: fontWeights.semibold,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
