import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useGameStyles } from '../../components/lessons/useGameStyles';

const PAIRS = [
  { word: 'happy', meaning: 'feeling joy' },
  { word: 'sad', meaning: 'feeling sorrow' },
  { word: 'big', meaning: 'large in size' },
  { word: 'small', meaning: 'little in size' },
];

export interface WordMatchingGameProps {
  onComplete: (score: number) => void;
  onProgress?: (progress: number) => void;
}

export const WordMatchingGame: React.FC<WordMatchingGameProps> = ({ onComplete, onProgress }) => {
  const styles = useGameStyles();
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [selectedMeaning, setSelectedMeaning] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);

  const checkMatch = (word: string, meaning: string) => {
    const pair = PAIRS.find((p) => p.word === word);
    if (pair?.meaning === meaning) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const next = [...matched, word];
      setMatched(next);
      setSelectedWord(null);
      setSelectedMeaning(null);
      onProgress?.((next.length / PAIRS.length) * 100);
      if (next.length >= PAIRS.length) onComplete(100);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setSelectedWord(null);
      setSelectedMeaning(null);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Match words with meanings</Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          {PAIRS.map((pair) => (
            <TouchableOpacity
              key={pair.word}
              style={[
                styles.optionButton,
                selectedWord === pair.word && styles.optionButtonSelected,
              ]}
              onPress={() => {
                setSelectedWord(pair.word);
                if (selectedMeaning) checkMatch(pair.word, selectedMeaning);
              }}
            >
              <Text style={styles.optionText}>{pair.word}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ flex: 1 }}>
          {PAIRS.map((pair) => (
            <TouchableOpacity
              key={pair.meaning}
              style={[
                styles.optionButton,
                selectedMeaning === pair.meaning && styles.optionButtonSelected,
              ]}
              onPress={() => {
                setSelectedMeaning(pair.meaning);
                if (selectedWord) checkMatch(selectedWord, pair.meaning);
              }}
            >
              <Text style={styles.optionText}>{pair.meaning}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <Text style={styles.score}>Matched: {matched.length}/{PAIRS.length}</Text>
    </View>
  );
};
