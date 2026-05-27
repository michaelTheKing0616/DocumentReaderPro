import { UserProfile, UXPreferences } from '../../types';

export class UXPersonalizer {
  // Suggest theme based on user profile
  static suggestTheme(profile: UserProfile): 'light' | 'dark' | 'sepia' | 'high-contrast' {
    if (profile.challenges.includes('dyslexia')) {
      return 'high-contrast'; // Better for visual stress
    }
    
    const hour = new Date().getHours();
    if (hour >= 18 || hour < 6) {
      return 'dark'; // Night mode
    }
    
    return 'light';
  }

  // Suggest font size based on challenges
  static suggestFontSize(profile: UserProfile): number {
    if (profile.challenges.includes('dyslexia')) {
      return 18; // Larger for readability
    }
    if (profile.challenges.includes('adhd')) {
      return 16; // Moderate size
    }
    return 14; // Default
  }

  // Suggest reading mode
  static suggestReadingMode(profile: UserProfile): 'normal' | 'guided' | 'focus' {
    if (profile.challenges.includes('adhd')) {
      return 'guided'; // Line-by-line for focus
    }
    return 'normal';
  }

  // Get personalized preferences
  static getPersonalizedPreferences(profile: UserProfile): Partial<UXPreferences> {
    return {
      animationSpeed: profile.challenges.includes('adhd') ? 'slow' : 'normal',
      hapticFeedback: true, // Always helpful
      voiceCommands: profile.challenges.includes('dyslexia'), // Helpful for dyslexia
      gestureControls: true,
      theme: this.suggestTheme(profile),
    };
  }
}

