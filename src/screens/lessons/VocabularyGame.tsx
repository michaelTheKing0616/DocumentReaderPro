import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import TTService from '../../services/tts/TTService';
import { UserPreferences } from '../../types';
import { useGameStyles } from '../../components/lessons/useGameStyles';
import { useTheme } from '../../theme/useTheme';

interface VocabItem {
  word: string;
  definition: string;
  distractors: string[];
}

const VOCAB_BANK: VocabItem[] = [
  {
    word: 'brave',
    definition: 'Ready to face danger or pain; courageous.',
    distractors: ['Afraid of everything', 'Very sleepy', 'Unable to speak'],
  },
  {
    word: 'curious',
    definition: 'Eager to know or learn something.',
    distractors: ['Bored and uninterested', 'Always angry', 'Moving very fast'],
  },
  {
    word: 'gentle',
    definition: 'Mild in temperament or behavior; kind.',
    distractors: ['Rough and harsh', 'Extremely loud', 'Impossible to see'],
  },
  {
    word: 'ancient',
    definition: 'Belonging to the very distant past.',
    distractors: ['Brand new today', 'Made of plastic', 'Happening tomorrow'],
  },
  {
    word: 'fragile',
    definition: 'Easily broken or damaged.',
    distractors: ['Impossible to break', 'Very heavy metal', 'Always growing'],
  },
];

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export interface VocabularyGameProps {
  preferences: UserPreferences;
  onComplete: (score: number) => void;
  onProgress?: (progress: number) => void;
}

export const VocabularyGame: React.FC<VocabularyGameProps> = ({
  preferences,
  onComplete,
  onProgress,
}) => {
  const styles = useGameStyles();
  const { theme } = useTheme();
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const item = VOCAB_BANK[index % VOCAB_BANK.length];

  const options = useMemo(() => {
    const all = [item.definition, ...item.distractors];
    return shuffle(all);
  }, [item]);

  const correctIndex = options.indexOf(item.definition);

  const handleSelect = (optionIndex: number) => {
    if (selected != null) return;
    setSelected(optionIndex);

    const isCorrect = optionIndex === correctIndex;
    if (isCorrect) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCorrect((c) => c + 1);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Not quite', `The correct meaning of "${item.word}" is:\n${item.definition}`);
    }

    TTService.speak(item.word, preferences);

    const nextIndex = index + 1;
    onProgress?.(Math.round((nextIndex / VOCAB_BANK.length) * 100));

    setTimeout(() => {
      if (nextIndex >= VOCAB_BANK.length) {
        onComplete(Math.round(((correct + (isCorrect ? 1 : 0)) / VOCAB_BANK.length) * 100));
      } else {
        setIndex(nextIndex);
        setSelected(null);
      }
    }, 900);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Vocabulary Match</Text>
      <Text style={styles.meta}>
        Word {Math.min(index + 1, VOCAB_BANK.length)}/{VOCAB_BANK.length}
      </Text>

      <TouchableOpacity onPress={() => TTService.speak(item.word, preferences)}>
        <Text style={styles.wordDisplay}>{item.word}</Text>
        <Text style={[styles.meta, { fontSize: 12, marginBottom: theme.spacing.xl }]}>
          Tap word to hear it
        </Text>
      </TouchableOpacity>

      <Text style={[styles.accentText, { color: theme.colors.text, fontWeight: '600' }]}>
        Choose the correct meaning:
      </Text>

      {options.map((option, optionIndex) => (
        <TouchableOpacity
          key={option}
          style={[
            styles.optionButton,
            selected === optionIndex &&
              (optionIndex === correctIndex
                ? { borderColor: theme.colors.success, backgroundColor: theme.colors.successMuted }
                : { borderColor: theme.colors.error, backgroundColor: theme.colors.errorMuted }),
          ]}
          onPress={() => handleSelect(optionIndex)}
          disabled={selected != null}
        >
          <Text style={styles.optionText}>{option}</Text>
        </TouchableOpacity>
      ))}

      <Text style={styles.score}>Correct: {correct}</Text>
    </View>
  );
};
