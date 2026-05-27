import { Dimensions } from 'react-native';

export function getScreenDimensions(): { width: number; height: number } {
  const { width, height } = Dimensions.get('window');
  return { width, height };
}
