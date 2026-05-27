import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';

export type ReadingMode = 'normal' | 'focus' | 'guided';

interface ReadingModeControllerProps {
  mode: ReadingMode;
  lineSpacing: number;
  fontSize: number;
  children: React.ReactNode;
  onGuidedLineAdvance?: () => void;
}

const GUIDED_LINE_HEIGHT = 48;
const GUIDED_ADVANCE_MS = 4000;

export const ReadingModeController: React.FC<ReadingModeControllerProps> = ({
  mode,
  lineSpacing,
  fontSize,
  children,
  onGuidedLineAdvance,
}) => {
  const [guidedY, setGuidedY] = useState(120);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (mode !== 'guided') {
      return;
    }

    const lineHeight = fontSize * lineSpacing;
    const interval = setInterval(() => {
      setGuidedY((prev) => {
        const next = prev + lineHeight;
        const maxY = Dimensions.get('window').height - GUIDED_LINE_HEIGHT;
        if (next > maxY) {
          onGuidedLineAdvance?.();
          return 120;
        }
        return next;
      });
    }, GUIDED_ADVANCE_MS);

    return () => clearInterval(interval);
  }, [mode, fontSize, lineSpacing, onGuidedLineAdvance]);

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: mode === 'focus' ? 0 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [mode, opacity]);

  return (
    <View style={styles.container}>
      <View style={[styles.content, mode === 'focus' && styles.focusContent]}>{children}</View>

      {mode === 'guided' && (
        <View
          style={[
            styles.guidedLine,
            {
              top: guidedY,
              height: GUIDED_LINE_HEIGHT,
            },
          ]}
          pointerEvents="none"
        />
      )}

      {mode === 'focus' && <View style={styles.focusDim} pointerEvents="none" />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  focusContent: {
    paddingTop: 8,
  },
  guidedLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 122, 255, 0.12)',
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: 'rgba(0, 122, 255, 0.35)',
  },
  focusDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
});

export default ReadingModeController;
