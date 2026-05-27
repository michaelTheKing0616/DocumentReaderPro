import React, { useCallback, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, PanResponder, Dimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useGameStyles } from './useGameStyles';
import { useTheme } from '../../theme/useTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CANVAS_WIDTH = SCREEN_WIDTH - 32;
const CANVAS_HEIGHT = 220;
const NODE_RADIUS = 14;
const TOTAL_ROUNDS = 5;

/** H-pattern reading path: left → center → right → center (classic dyslexia tracking drill). */
const H_PATTERN_NODES = [
  { id: 'left', x: CANVAS_WIDTH * 0.15, y: CANVAS_HEIGHT * 0.5, label: 'L' },
  { id: 'center-top', x: CANVAS_WIDTH * 0.5, y: CANVAS_HEIGHT * 0.2, label: 'T' },
  { id: 'right', x: CANVAS_WIDTH * 0.85, y: CANVAS_HEIGHT * 0.5, label: 'R' },
  { id: 'center-bottom', x: CANVAS_WIDTH * 0.5, y: CANVAS_HEIGHT * 0.8, label: 'B' },
];

const EXPECTED_SEQUENCE = ['left', 'center-top', 'right', 'center-bottom'];

interface HPatternGameProps {
  onComplete: (score: number) => void;
  onProgress?: (progress: number) => void;
}

export const HPatternGame: React.FC<HPatternGameProps> = ({ onComplete, onProgress }) => {
  const styles = useGameStyles();
  const { theme } = useTheme();
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [visited, setVisited] = useState<string[]>([]);
  const startTimeRef = useRef<number>(Date.now());

  const reportProgress = useCallback(
    (nextRound: number, nextScore: number) => {
      const progress = Math.min(100, ((nextRound + nextScore / TOTAL_ROUNDS) / TOTAL_ROUNDS) * 100);
      onProgress?.(progress);
    },
    [onProgress]
  );

  const handleNodeTap = (nodeId: string) => {
    const expected = EXPECTED_SEQUENCE[currentStep];
    if (nodeId === expected) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const nextStep = currentStep + 1;
      const nextVisited = [...visited, nodeId];
      setVisited(nextVisited);
      setFeedback('Good!');

      if (nextStep >= EXPECTED_SEQUENCE.length) {
        const elapsed = Date.now() - startTimeRef.current;
        const roundScore = elapsed < 8000 ? 1 : 0.5;
        const nextScore = score + roundScore;
        const nextRound = round + 1;
        setScore(nextScore);
        setRound(nextRound);
        setCurrentStep(0);
        setVisited([]);
        startTimeRef.current = Date.now();
        reportProgress(nextRound, nextScore);

        if (nextRound >= TOTAL_ROUNDS) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onComplete(Math.round((nextScore / TOTAL_ROUNDS) * 100));
        } else {
          setFeedback(`Round ${nextRound} complete!`);
        }
      } else {
        setCurrentStep(nextStep);
      }
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setFeedback('Follow the H pattern: L → T → R → B');
      setCurrentStep(0);
      setVisited([]);
      startTimeRef.current = Date.now();
    }
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderRelease: (_, gesture) => {
      const { moveX, moveY } = gesture;
      for (const node of H_PATTERN_NODES) {
        const dx = moveX - node.x - 16;
        const dy = moveY - node.y - 80;
        if (Math.sqrt(dx * dx + dy * dy) < NODE_RADIUS * 2) {
          handleNodeTap(node.id);
          break;
        }
      }
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>H-Pattern Tracking</Text>
      <Text style={styles.meta}>
        Trace the H: tap Left → Top → Right → Bottom
      </Text>
      <Text style={styles.accentText}>
        Round {Math.min(round + 1, TOTAL_ROUNDS)}/{TOTAL_ROUNDS} · Score: {Math.round(score)}
      </Text>

      <View
        style={[
          styles.card,
          {
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            alignSelf: 'center',
            position: 'relative',
            marginBottom: 0,
            padding: 0,
          },
        ]}
        {...panResponder.panHandlers}
      >
        {H_PATTERN_NODES.map((node) => {
          const isActive = EXPECTED_SEQUENCE[currentStep] === node.id;
          const isDone = visited.includes(node.id);
          return (
            <TouchableOpacity
              key={node.id}
              style={[
                {
                  position: 'absolute',
                  width: NODE_RADIUS * 2,
                  height: NODE_RADIUS * 2,
                  borderRadius: NODE_RADIUS,
                  justifyContent: 'center',
                  alignItems: 'center',
                  left: node.x - NODE_RADIUS,
                  top: node.y - NODE_RADIUS,
                  backgroundColor: isDone
                    ? theme.colors.success
                    : isActive
                      ? theme.colors.primary
                      : theme.colors.border,
                },
              ]}
              onPress={() => handleNodeTap(node.id)}
              accessibilityLabel={`Node ${node.label}`}
            >
              <Text style={{ color: theme.colors.textInverse, fontWeight: '700', fontSize: 12 }}>
                {node.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {feedback && <Text style={styles.feedback}>{feedback}</Text>}
    </View>
  );
};
