import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInRight, SlideOutLeft } from 'react-native-reanimated';

const ENTER_DURATION_MS = 250;
const EXIT_DURATION_MS = 200;

interface PageTransitionProps {
  pageKey: number | string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function PageTransition({ pageKey, children, style }: PageTransitionProps) {
  return (
    <Animated.View
      key={String(pageKey)}
      entering={SlideInRight.duration(ENTER_DURATION_MS).springify().damping(18)}
      exiting={SlideOutLeft.duration(EXIT_DURATION_MS)}
      style={[{ flex: 1 }, style]}
    >
      {children}
    </Animated.View>
  );
}

/** Lighter fade variant for overlays or secondary content. */
export function FadeTransition({ pageKey, children, style }: PageTransitionProps) {
  return (
    <Animated.View
      key={String(pageKey)}
      entering={FadeIn.duration(ENTER_DURATION_MS)}
      exiting={FadeOut.duration(EXIT_DURATION_MS)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}
