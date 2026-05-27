import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from '../../theme/useTheme';

export function useGameStyles() {
  const { theme } = useTheme();

  return useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          padding: theme.spacing.lg,
          backgroundColor: theme.colors.background,
        },
        title: {
          ...theme.typography.title,
          textAlign: 'center',
          color: theme.colors.text,
          marginBottom: theme.spacing.sm,
        },
        meta: {
          ...theme.typography.caption,
          textAlign: 'center',
          color: theme.colors.textMuted,
          marginBottom: theme.spacing.lg,
        },
        card: {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.xl,
          marginBottom: theme.spacing.xl,
          borderWidth: 1,
          borderColor: theme.colors.borderSubtle,
          ...theme.shadows.sm,
        },
        cardText: {
          ...theme.typography.body,
          fontSize: 20,
          lineHeight: 32,
          color: theme.colors.text,
          textAlign: 'center',
        },
        accentText: {
          ...theme.typography.body,
          textAlign: 'center',
          color: theme.colors.primary,
          marginBottom: theme.spacing.md,
        },
        primaryButton: {
          backgroundColor: theme.colors.primary,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.xl,
          borderRadius: theme.radius.md,
          alignItems: 'center',
          minHeight: theme.spacing['4xl'],
          justifyContent: 'center',
        },
        primaryButtonText: {
          ...theme.typography.label,
          color: theme.colors.textInverse,
        },
        optionButton: {
          padding: theme.spacing.md,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          marginBottom: theme.spacing.sm,
        },
        optionButtonSelected: {
          borderColor: theme.colors.primary,
          backgroundColor: theme.colors.surfaceMuted,
        },
        optionText: {
          ...theme.typography.body,
          color: theme.colors.text,
          textAlign: 'center',
        },
        feedback: {
          ...theme.typography.body,
          textAlign: 'center',
          color: theme.colors.textSecondary,
          marginVertical: theme.spacing.lg,
        },
        score: {
          ...theme.typography.caption,
          textAlign: 'center',
          marginTop: theme.spacing.lg,
          color: theme.colors.textMuted,
        },
        wordDisplay: {
          ...theme.typography.display,
          textAlign: 'center',
          color: theme.colors.primary,
          marginBottom: theme.spacing.xl,
        },
      }),
    [theme]
  );
}
