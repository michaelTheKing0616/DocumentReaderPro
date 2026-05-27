import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { LottieAnimation, LottiePreset } from './LottieAnimation';
import { useTheme } from '../../theme/useTheme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface EmptyStateProps {
  icon?: IconName;
  lottie?: LottiePreset;
  title: string;
  description?: string;
  action?: React.ReactNode;
  style?: ViewStyle;
}

export function EmptyState({
  icon = 'document-text-outline',
  lottie,
  title,
  description,
  action,
  style,
}: EmptyStateProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          paddingHorizontal: theme.spacing['2xl'],
          paddingVertical: theme.spacing['3xl'],
        },
        style,
      ]}
    >
      {lottie ? (
        <LottieAnimation preset={lottie} size={100} style={{ marginBottom: theme.spacing.lg }} />
      ) : (
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderRadius: theme.radius.full,
              marginBottom: theme.spacing.lg,
              width: theme.spacing['6xl'],
              height: theme.spacing['6xl'],
            },
          ]}
        >
          <Ionicons name={icon} size={32} color={theme.colors.accent} />
        </View>
      )}

      <Text variant="title" style={{ textAlign: 'center', marginBottom: theme.spacing.sm }}>
        {title}
      </Text>

      {description ? (
        <Text
          variant="body"
          color="secondary"
          style={{ textAlign: 'center', marginBottom: theme.spacing.lg }}
        >
          {description}
        </Text>
      ) : null}

      {action ? <View style={{ marginTop: theme.spacing.md }}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
