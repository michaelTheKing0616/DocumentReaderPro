import { useState, useCallback } from 'react';
import { UserPreferences } from '../types';
import TTService from '../services/tts/TTService';

export const useTTS = (preferences: UserPreferences) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);

  const speak = useCallback(
    async (text: string) => {
      if (!preferences.ttsEnabled) return;

      setIsSpeaking(true);
      setCurrentWordIndex(-1);

      await TTService.speak(text, preferences, (index) => {
        setCurrentWordIndex(index);
      });

      setIsSpeaking(false);
      setCurrentWordIndex(-1);
    },
    [preferences]
  );

  const stop = useCallback(async () => {
    await TTService.stop();
    setIsSpeaking(false);
    setCurrentWordIndex(-1);
  }, []);

  return {
    isSpeaking,
    currentWordIndex,
    speak,
    stop,
  };
};

