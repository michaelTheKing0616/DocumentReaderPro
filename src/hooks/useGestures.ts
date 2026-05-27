import { useCallback } from 'react';
import { GestureResponderEvent } from 'react-native';

export type GestureType = 'swipe-left' | 'swipe-right' | 'swipe-up' | 'swipe-down' | 'pinch' | 'double-tap';

export const useGestures = (
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  onSwipeUp?: () => void,
  onSwipeDown?: () => void,
  onPinch?: (scale: number) => void,
  onDoubleTap?: () => void
) => {
  // Handle swipe gestures
  const handleSwipe = useCallback((direction: 'left' | 'right' | 'up' | 'down') => {
    switch (direction) {
      case 'left':
        onSwipeLeft?.();
        break;
      case 'right':
        onSwipeRight?.();
        break;
      case 'up':
        onSwipeUp?.();
        break;
      case 'down':
        onSwipeDown?.();
        break;
    }
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);

  // Handle pinch gesture
  const handlePinch = useCallback((scale: number) => {
    onPinch?.(scale);
  }, [onPinch]);

  // Handle double tap
  const handleDoubleTap = useCallback(() => {
    onDoubleTap?.();
  }, [onDoubleTap]);

  return {
    handleSwipe,
    handlePinch,
    handleDoubleTap,
  };
};

