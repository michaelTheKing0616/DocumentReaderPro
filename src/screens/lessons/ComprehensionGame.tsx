import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useGameStyles } from '../../components/lessons/useGameStyles';
import { useTheme } from '../../theme/useTheme';

interface ComprehensionItem {
  passage: string;
  question: string;
  options: string[];
  correctAnswer: number;
}

const ITEMS: ComprehensionItem[] = [
  {
    passage:
      'Maya packed her bag early because the field trip bus left at seven. She double-checked for her lunch and notebook before walking to the corner stop.',
    question: 'Why did Maya pack her bag early?',
    options: [
      'The bus left early in the morning',
      'She forgot her homework',
      'It was raining outside',
      'She stayed home from school',
    ],
    correctAnswer: 0,
  },
  {
    passage:
      'The library added new chairs near the windows so readers could sit in natural light. Many students said the bright space helped them focus longer.',
    question: 'What change did the library make?',
    options: [
      'It removed all the books',
      'It added chairs by the windows',
      'It closed on weekends',
      'It banned talking forever',
    ],
    correctAnswer: 1,
  },
  {
    passage:
      'When the trail forked, Leo chose the shorter path even though it was steeper. He wanted to reach the lookout before sunset.',
    question: 'Why did Leo take the shorter path?',
    options: [
      'He was afraid of heights',
      'He wanted to arrive before sunset',
      'The longer path was closed',
      'He lost his map',
    ],
    correctAnswer: 1,
  },
  {
    passage:
      'The recipe said to mix the dry ingredients first, then slowly add the wet ones. This kept the batter smooth without lumps.',
    question: 'What happens when you add wet ingredients slowly?',
    options: [
      'The batter stays smooth',
      'The oven turns off',
      'The food becomes salty',
      'The timer stops working',
    ],
    correctAnswer: 0,
  },
  {
    passage:
      'After weeks of practice, the team won their first match. Coach Rivera reminded them that consistent effort mattered more than one lucky day.',
    question: 'What did the coach emphasize?',
    options: [
      'Luck is all that matters',
      'Practice and consistent effort',
      'Winning without trying',
      'Skipping future games',
    ],
    correctAnswer: 1,
  },
];

export interface ComprehensionGameProps {
  onComplete: (score: number) => void;
  onProgress?: (progress: number) => void;
}

export const ComprehensionGame: React.FC<ComprehensionGameProps> = ({
  onComplete,
  onProgress,
}) => {
  const styles = useGameStyles();
  const { theme } = useTheme();
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const item = ITEMS[index];

  const handleAnswer = (optionIndex: number) => {
    if (selected != null) return;
    setSelected(optionIndex);

    const isCorrect = optionIndex === item.correctAnswer;
    if (isCorrect) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCorrectCount((c) => c + 1);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Review the passage',
        `Correct answer: ${item.options[item.correctAnswer]}`
      );
    }

    const nextIndex = index + 1;
    onProgress?.(Math.round((nextIndex / ITEMS.length) * 100));

    setTimeout(() => {
      if (nextIndex >= ITEMS.length) {
        onComplete(
          Math.round(((correctCount + (isCorrect ? 1 : 0)) / ITEMS.length) * 100)
        );
      } else {
        setIndex(nextIndex);
        setSelected(null);
      }
    }, 800);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: theme.spacing['2xl'] }}>
      <Text style={styles.title}>Comprehension Check</Text>
      <Text style={styles.meta}>
        Passage {Math.min(index + 1, ITEMS.length)}/{ITEMS.length}
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardText}>{item.passage}</Text>
      </View>

      <Text style={[styles.accentText, { color: theme.colors.text, fontWeight: '600' }]}>
        {item.question}
      </Text>

      {item.options.map((option, optionIndex) => (
        <TouchableOpacity
          key={option}
          style={[
            styles.optionButton,
            selected === optionIndex &&
              (optionIndex === item.correctAnswer
                ? { borderColor: theme.colors.success, backgroundColor: theme.colors.successMuted }
                : { borderColor: theme.colors.error, backgroundColor: theme.colors.errorMuted }),
          ]}
          onPress={() => handleAnswer(optionIndex)}
          disabled={selected != null}
        >
          <Text style={styles.optionText}>{option}</Text>
        </TouchableOpacity>
      ))}

      <Text style={styles.score}>Correct: {correctCount}</Text>
    </ScrollView>
  );
};
