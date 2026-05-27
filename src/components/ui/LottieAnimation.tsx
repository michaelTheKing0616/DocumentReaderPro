import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import LottieView from 'lottie-react-native';

export type LottiePreset = 'loading' | 'success' | 'empty';

const PRESET_SOURCES: Record<LottiePreset, ReturnType<typeof require>> = {
  loading: require('../../../assets/lottie/loading.json'),
  success: require('../../../assets/lottie/success.json'),
  empty: require('../../../assets/lottie/empty.json'),
};

interface LottieAnimationProps {
  preset: LottiePreset;
  size?: number;
  loop?: boolean;
  autoPlay?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function LottieAnimation({
  preset,
  size = 120,
  loop,
  autoPlay = true,
  style,
}: LottieAnimationProps) {
  const shouldLoop = loop ?? preset === 'loading';

  return (
    <LottieView
      source={PRESET_SOURCES[preset]}
      style={[{ width: size, height: size }, style]}
      loop={shouldLoop}
      autoPlay={autoPlay}
    />
  );
}
