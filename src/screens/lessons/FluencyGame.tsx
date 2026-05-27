import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import TTService from '../../services/tts/TTService';
import { UserPreferences } from '../../types';
import { useGameStyles } from '../../components/lessons/useGameStyles';

const PASSAGES = [
  {
    id: 'p1',
    text: 'The quick brown fox jumps over the lazy dog near the river bank.',
    wpmTarget: 120,
  },
  {
    id: 'p2',
    text: 'Reading fluently means reading smoothly with expression and good pacing.',
    wpmTarget: 130,
  },
  {
    id: 'p3',
    text: 'Practice every day to build speed without losing comprehension.',
    wpmTarget: 140,
  },
  {
    id: 'p4',
    text: 'Track your eyes left to right and pause briefly at punctuation marks.',
    wpmTarget: 130,
  },
  {
    id: 'p5',
    text: 'Confidence grows when you recognize words instantly on the page.',
    wpmTarget: 150,
  },
];

const ROUND_COUNT = PASSAGES.length;

export interface FluencyGameProps {
  preferences: UserPreferences;
  onComplete: (score: number) => void;
  onProgress?: (progress: number) => void;
}

export const FluencyGame: React.FC<FluencyGameProps> = ({
  preferences,
  onComplete,
  onProgress,
}) => {
  const styles = useGameStyles();
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<'ready' | 'reading' | 'done'>('ready');
  const [score, setScore] = useState(0);
  const startRef = useRef<number>(0);

  const passage = PASSAGES[round % PASSAGES.length];

  useEffect(() => {
    onProgress?.(Math.round((round / ROUND_COUNT) * 100));
  }, [round, onProgress]);

  const startReading = () => {
    startRef.current = Date.now();
    setPhase('reading');
    TTService.speak(passage.text, preferences);
  };

  const finishRound = useCallback(() => {
    TTService.stop();
    const elapsedSec = Math.max((Date.now() - startRef.current) / 1000, 1);
    const wordCount = passage.text.split(/\s+/).length;
    const wpm = Math.round((wordCount / elapsedSec) * 60);
    const ratio = wpm / passage.wpmTarget;
    const roundScore = ratio >= 1 ? 1 : ratio >= 0.75 ? 0.75 : 0.5;
    const nextScore = score + roundScore;
    const nextRound = round + 1;

    Haptics.notificationAsync(
      ratio >= 1
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning
    );

    setScore(nextScore);
    setPhase('done');

    if (nextRound >= ROUND_COUNT) {
      onComplete(Math.round((nextScore / ROUND_COUNT) * 100));
    } else {
      setTimeout(() => {
        setRound(nextRound);
        setPhase('ready');
      }, 1200);
    }
  }, [passage, round, score, onComplete]);

  const elapsedWpm =
    phase === 'reading' && startRef.current
      ? Math.round(
          (passage.text.split(/\s+/).length / Math.max((Date.now() - startRef.current) / 1000, 1)) *
            60
        )
      : 0;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Fluency Challenge</Text>
      <Text style={styles.meta}>
        Round {Math.min(round + 1, ROUND_COUNT)}/{ROUND_COUNT} · Target {passage.wpmTarget} WPM
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardText}>{passage.text}</Text>
      </View>

      {phase === 'ready' && (
        <TouchableOpacity style={styles.primaryButton} onPress={startReading}>
          <Text style={styles.primaryButtonText}>Start Reading Aloud</Text>
        </TouchableOpacity>
      )}

      {phase === 'reading' && (
        <>
          <Text style={styles.accentText}>Current pace: ~{elapsedWpm} WPM</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={finishRound}>
            <Text style={styles.primaryButtonText}>Done Reading</Text>
          </TouchableOpacity>
        </>
      )}

      {phase === 'done' && (
        <Text style={styles.feedback}>
          {round + 1 >= ROUND_COUNT ? 'All rounds complete!' : 'Nice work — next passage…'}
        </Text>
      )}

      <Text style={styles.score}>Score: {Math.round(score)}/{ROUND_COUNT}</Text>
    </View>
  );
};
