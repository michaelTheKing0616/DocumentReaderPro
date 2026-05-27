import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { UserPreferences } from '../../types';
import { useGameStyles } from '../../components/lessons/useGameStyles';

export interface SyllableGameProps {
  preferences: UserPreferences;
  onComplete: (score: number) => void;
  onProgress?: (progress: number) => void;
}

const WORDS = ['cat', 'elephant', 'butterfly', 'dog', 'computer', 'book'];
const TOTAL = 5;

export const SyllableGame: React.FC<SyllableGameProps> = ({ onComplete, onProgress }) => {
  const styles = useGameStyles();
  const [round, setRound] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const currentWord = WORDS[round % WORDS.length];
  const correctSyllables = currentWord.match(/[aeiouy]+/gi)?.length ?? 1;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Count the syllables</Text>
      <Text style={styles.meta}>Round {Math.min(round + 1, TOTAL)}/{TOTAL}</Text>
      <Text style={styles.wordDisplay}>{currentWord}</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 24 }}>
        {[1, 2, 3, 4, 5].map((count) => (
          <TouchableOpacity
            key={count}
            style={[
              styles.optionButton,
              {
                width: 56,
                height: 56,
                borderRadius: 28,
                margin: 8,
                marginBottom: 8,
                justifyContent: 'center',
                alignItems: 'center',
              },
              selected === count && styles.optionButtonSelected,
            ]}
            onPress={() => setSelected(count)}
          >
            <Text style={[styles.optionText, { fontSize: 22, fontWeight: '700' }]}>{count}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => {
          if (selected === correctSyllables) {
            const next = round + 1;
            onProgress?.((next / TOTAL) * 100);
            if (next >= TOTAL) onComplete(100);
            else {
              setRound(next);
              setSelected(null);
            }
          } else {
            Alert.alert('Try again!');
          }
        }}
      >
        <Text style={styles.primaryButtonText}>Check Answer</Text>
      </TouchableOpacity>
    </View>
  );
};
