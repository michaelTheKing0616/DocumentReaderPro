import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import {
  SafeAreaView,
  Edge,
} from 'react-native-safe-area-context';
import { useTheme } from '../../theme/useTheme';

interface ScreenProps extends ViewProps {
  edges?: Edge[];
  padded?: boolean;
}

export function Screen({
  children,
  style,
  edges = ['top', 'bottom', 'left', 'right'],
  padded = true,
  ...rest
}: ScreenProps) {
  const { theme } = useTheme();

  return (
    <SafeAreaView
      edges={edges}
      style={[styles.flex, { backgroundColor: theme.colors.background }, style]}
      {...rest}
    >
      {padded ? (
        <View style={[styles.flex, { paddingHorizontal: theme.spacing.lg }]}>
          {children}
        </View>
      ) : (
        children
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});
