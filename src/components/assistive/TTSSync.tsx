import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTTS } from '../../hooks/useTTS';
import { UserPreferences } from '../../types';

interface TTSSyncProps {
  text: string;
  preferences: UserPreferences;
  onWordHighlight?: (wordIndex: number) => void;
}

export const TTSSync: React.FC<TTSSyncProps> = ({
  text,
  preferences,
  onWordHighlight,
}) => {
  const { isSpeaking, currentWordIndex, speak, stop } = useTTS(preferences);

  const words = text.split(/\s+/);

  React.useEffect(() => {
    if (preferences.ttsEnabled && text) {
      speak(text);
    }
    return () => {
      stop();
    };
  }, [text, preferences.ttsEnabled]);

  React.useEffect(() => {
    if (currentWordIndex >= 0 && onWordHighlight) {
      onWordHighlight(currentWordIndex);
    }
  }, [currentWordIndex, onWordHighlight]);

  return (
    <View style={styles.container}>
      <View style={styles.textContainer}>
        {words.map((word, index) => (
          <Text
            key={index}
            style={[
              styles.word,
              currentWordIndex === index && styles.highlightedWord,
            ]}
          >
            {word}{' '}
          </Text>
        ))}
      </View>
      {isSpeaking && (
        <View style={styles.controls}>
          <Text style={styles.controlText}>Speaking...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  textContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
  },
  word: {
    fontSize: 16,
    color: '#000000',
  },
  highlightedWord: {
    backgroundColor: '#FFEB3B',
    fontWeight: 'bold',
  },
  controls: {
    padding: 8,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
  },
  controlText: {
    fontSize: 12,
    color: '#1976D2',
  },
});

