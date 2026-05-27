import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import TTService from '../../services/tts/TTService';
import { UserPreferences } from '../../types';

interface MultisensoryWordProps {
  word: string;
  index: number;
  highlighted: boolean;
  preferences: UserPreferences;
  fontSize?: number;
  color?: string;
  onPress?: (word: string, index: number) => void;
}

export const MultisensoryWord: React.FC<MultisensoryWordProps> = ({
  word,
  index,
  highlighted,
  preferences,
  fontSize = 16,
  color = '#000000',
  onPress,
}) => {
  const handlePress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await TTService.speak(word, preferences);
    onPress?.(word, index);
  };

  return (
    <TouchableOpacity onPress={() => void handlePress()} activeOpacity={0.7}>
      <Text
        style={[
          styles.word,
          { fontSize, color },
          highlighted && styles.highlighted,
        ]}
      >
        {word}{' '}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  word: {
    lineHeight: 24,
  },
  highlighted: {
    backgroundColor: '#FFEB3B',
    fontWeight: '700',
  },
});

export default MultisensoryWord;
