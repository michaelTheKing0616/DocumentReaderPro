import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import TTService from '../../services/tts/TTService';
import { UserPreferences } from '../../types';
import { useGameStyles } from '../../components/lessons/useGameStyles';

export interface PhonemicGameProps {
  preferences: UserPreferences;
  onComplete: (score: number) => void;
  onProgress?: (progress: number) => void;
}

export const PhonemicGame: React.FC<PhonemicGameProps> = ({
  preferences,
  onComplete,
  onProgress,
}) => {
  const styles = useGameStyles();
  const [round, setRound] = useState(0);
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const words = [
    { word: 'cat', sound: 'c' },
    { word: 'dog', sound: 'd' },
    { word: 'car', sound: 'c' },
    { word: 'door', sound: 'd' },
    { word: 'cup', sound: 'c' },
    { word: 'duck', sound: 'd' },
  ];
  const targetSound = 'c';
  const correctWords = words.filter((w) => w.sound === targetSound).map((w) => w.word);
  const totalRounds = 5;

  const handleCheck = () => {
    const isCorrect =
      selectedWords.length === correctWords.length &&
      selectedWords.every((w) => correctWords.includes(w));
    if (isCorrect) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const nextRound = round + 1;
      onProgress?.((nextRound / totalRounds) * 100);
      setSelectedWords([]);
      if (nextRound >= totalRounds) onComplete(100);
      else setRound(nextRound);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Try again!', 'Select all words that start with the same sound.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Find words starting with &quot;{targetSound.toUpperCase()}&quot;</Text>
      <Text style={styles.meta}>Round {Math.min(round + 1, totalRounds)}/{totalRounds}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 24 }}>
        {words.map((item) => (
          <TouchableOpacity
            key={item.word}
            style={[
              styles.optionButton,
              { margin: 8 },
              selectedWords.includes(item.word) && styles.optionButtonSelected,
            ]}
            onPress={() => {
              setSelectedWords((prev) =>
                prev.includes(item.word) ? prev.filter((w) => w !== item.word) : [...prev, item.word]
              );
              TTService.speak(item.word, preferences);
            }}
          >
            <Text style={styles.optionText}>{item.word}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={styles.primaryButton} onPress={handleCheck}>
        <Text style={styles.primaryButtonText}>Check Answer</Text>
      </TouchableOpacity>
    </View>
  );
};
