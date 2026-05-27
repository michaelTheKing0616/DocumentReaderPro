import * as Speech from 'expo-speech';
import { UserPreferences } from '../../types';

class TTService {
  private isSpeaking: boolean = false;
  private currentUtterance?: string;
  private onWordHighlight?: (wordIndex: number) => void;

  async speak(
    text: string,
    preferences: UserPreferences,
    onWordHighlight?: (wordIndex: number) => void
  ): Promise<void> {
    if (this.isSpeaking) {
      await this.stop();
    }

    this.onWordHighlight = onWordHighlight;
    this.currentUtterance = text;
    this.isSpeaking = true;

    // Split text into words for highlighting
    const words = text.split(/\s+/);
    const wordsPerMinute = preferences.ttsSpeed || 150;

    // Calculate delay between words
    const delayPerWord = (60 / wordsPerMinute) * 1000;

    return new Promise((resolve) => {
      Speech.speak(text, {
        language: 'en',
        pitch: 1.0,
        rate: wordsPerMinute / 200, // Normalize to Speech API rate (0.0-1.0)
        onDone: () => {
          this.isSpeaking = false;
          this.currentUtterance = undefined;
          resolve();
        },
        onStopped: () => {
          this.isSpeaking = false;
          this.currentUtterance = undefined;
          resolve();
        },
      });

      // Highlight words as they're spoken (simplified)
      if (onWordHighlight) {
        words.forEach((_, index) => {
          setTimeout(() => {
            if (this.isSpeaking) {
              onWordHighlight(index);
            }
          }, index * delayPerWord);
        });
      }
    });
  }

  async stop(): Promise<void> {
    if (this.isSpeaking) {
      Speech.stop();
      this.isSpeaking = false;
      this.currentUtterance = undefined;
    }
  }

  isCurrentlySpeaking(): boolean {
    return this.isSpeaking;
  }

  getCurrentUtterance(): string | undefined {
    return this.currentUtterance;
  }
}

export default new TTService();

