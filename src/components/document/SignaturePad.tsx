import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  Platform,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import { Button } from '../common/Button';
import { Text } from '../ui/Text';
import { useTheme } from '../../theme/useTheme';

interface Point {
  x: number;
  y: number;
}

export interface SignaturePadProps {
  width?: number;
  height?: number;
  strokeColor?: string;
  strokeWidth?: number;
  onSignatureChange?: (hasSignature: boolean) => void;
}

export interface SignaturePadHandle {
  clear: () => void;
  toBase64Png: () => Promise<string | null>;
  isEmpty: () => boolean;
}

function pointsToSvgPath(points: Point[]): string {
  if (points.length === 0) {
    return '';
  }
  const [first, ...rest] = points;
  let d = `M ${first.x} ${first.y}`;
  for (const point of rest) {
    d += ` L ${point.x} ${point.y}`;
  }
  return d;
}

export const SignaturePad = React.forwardRef<SignaturePadHandle, SignaturePadProps>(
  function SignaturePad(
    {
      width = 320,
      height = 160,
      strokeColor = '#1a1a2e',
      strokeWidth = 2.5,
      onSignatureChange,
    },
    ref
  ) {
    const { theme } = useTheme();
    const [strokes, setStrokes] = useState<Point[][]>([]);
    const currentStroke = useRef<Point[]>([]);
    const padRef = useRef<View>(null);

    const notifyChange = useCallback(
      (nextStrokes: Point[][]) => {
        onSignatureChange?.(nextStrokes.length > 0);
      },
      [onSignatureChange]
    );

    const clear = useCallback(() => {
      currentStroke.current = [];
      setStrokes([]);
      notifyChange([]);
    }, [notifyChange]);

    const isEmpty = useCallback(() => strokes.length === 0, [strokes]);

    const toBase64Png = useCallback(async (): Promise<string | null> => {
      if (strokes.length === 0) {
        return null;
      }

      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return null;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (const stroke of strokes) {
          if (stroke.length === 0) continue;
          ctx.beginPath();
          ctx.moveTo(stroke[0].x, stroke[0].y);
          for (let i = 1; i < stroke.length; i += 1) {
            ctx.lineTo(stroke[i].x, stroke[i].y);
          }
          ctx.stroke();
        }
        const dataUrl = canvas.toDataURL('image/png');
        return dataUrl.replace(/^data:image\/png;base64,/, '');
      }

      if (padRef.current) {
        const uri = await captureRef(padRef, {
          format: 'png',
          quality: 1,
          result: 'base64',
          width,
          height,
        });
        return uri.replace(/^data:image\/png;base64,/, '');
      }

      return null;
    }, [strokes, strokeColor, strokeWidth, width, height]);

    React.useImperativeHandle(ref, () => ({ clear, toBase64Png, isEmpty }), [
      clear,
      toBase64Png,
      isEmpty,
    ]);

    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event: GestureResponderEvent) => {
          const { locationX, locationY } = event.nativeEvent;
          currentStroke.current = [{ x: locationX, y: locationY }];
        },
        onPanResponderMove: (event: GestureResponderEvent) => {
          const { locationX, locationY } = event.nativeEvent;
          currentStroke.current = [
            ...currentStroke.current,
            { x: locationX, y: locationY },
          ];
          setStrokes((prev) => [...prev.slice(0, -1), [...currentStroke.current]]);
          if (currentStroke.current.length === 1) {
            setStrokes((prev) => [...prev, [...currentStroke.current]]);
          }
        },
        onPanResponderRelease: (
          _event: GestureResponderEvent,
          _gesture: PanResponderGestureState
        ) => {
          if (currentStroke.current.length > 0) {
            setStrokes((prev) => {
              const next = [...prev];
              if (next.length > 0) {
                next[next.length - 1] = [...currentStroke.current];
              } else {
                next.push([...currentStroke.current]);
              }
              notifyChange(next);
              return next;
            });
          }
          currentStroke.current = [];
        },
      })
    ).current;

    return (
      <View style={styles.wrapper}>
        <Text variant="label" style={styles.label}>
          Sign below
        </Text>
        <View
          ref={padRef}
          collapsable={false}
          style={[
            styles.pad,
            {
              width,
              height,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surfaceMuted,
            },
          ]}
          {...panResponder.panHandlers}
        >
          <Svg width={width} height={height}>
            {strokes.map((stroke, index) => (
              <Path
                key={`stroke-${index}`}
                d={pointsToSvgPath(stroke)}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </Svg>
        </View>
        <Button title="Clear Signature" variant="outline" onPress={clear} />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  label: {
    marginBottom: 4,
  },
  pad: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
});
