import { EyeMetrics, ReadingChallenge, UserProfile } from '../../types';

export const INTERVENTION_THRESHOLDS = {
  engagementBreak: 80,
  engagementFocusNudge: 60,
  focusNudgeDurationMs: 10_000,
  regressionSuggestTts: 0.2,
  adhdSelfMonitorIntervalMs: 5 * 60 * 1000,
  pointsPerPage: 10,
  dyslexiaDefaultLineSpacing: 1.5,
  dyslexiaDefaultTtsWpm: 150,
  brightnessDimOnFatigue: 0.2,
} as const;

export type InterventionType =
  | 'break_suggestion'
  | 'focus_nudge'
  | 'try_tts'
  | 'wider_spacing'
  | 'self_monitor'
  | 'pomodoro_break';

export interface Intervention {
  type: InterventionType;
  message: string;
  priority: 'low' | 'medium' | 'high';
}

class InterventionEngine {
  calculateEngagement(fixationTimeMs: number, pageTimeMs: number): number {
    if (pageTimeMs <= 0) {
      return 0;
    }
    return Math.min(100, (fixationTimeMs / pageTimeMs) * 100);
  }

  evaluateReadingSession(
    eyeMetrics: EyeMetrics,
    profile: UserProfile | null,
    pageTimeMs: number
  ): Intervention[] {
    const interventions: Intervention[] = [];
    const engagement = this.calculateEngagement(
      eyeMetrics.fixations.reduce((sum, f) => sum + f.duration, 0),
      pageTimeMs
    );

    if (engagement < INTERVENTION_THRESHOLDS.engagementBreak) {
      interventions.push({
        type: 'break_suggestion',
        message: 'Your engagement is low. Consider taking a short break.',
        priority: 'medium',
      });
    }

    if (engagement < INTERVENTION_THRESHOLDS.engagementFocusNudge) {
      interventions.push({
        type: 'focus_nudge',
        message: 'Focus reminder: your attention may have wandered.',
        priority: 'high',
      });
    }

    const regressionRatio =
      eyeMetrics.saccades.length > 0
        ? eyeMetrics.regressions.length / eyeMetrics.saccades.length
        : 0;

    if (regressionRatio > INTERVENTION_THRESHOLDS.regressionSuggestTts) {
      interventions.push({
        type: 'try_tts',
        message: 'High regressions detected — try TTS or wider line spacing.',
        priority: 'medium',
      });
    }

    const challenges = profile?.challenges ?? [];
    if (challenges.includes('adhd')) {
      interventions.push({
        type: 'self_monitor',
        message: "How's your focus right now?",
        priority: 'low',
      });
    }

    if (challenges.includes('dyslexia') && regressionRatio > 0.15) {
      interventions.push({
        type: 'wider_spacing',
        message: 'Try wider spacing or the OpenDyslexic font for this section.',
        priority: 'medium',
      });
    }

    return interventions;
  }

  getProfileDefaults(challenges: ReadingChallenge[]): Partial<UserProfile['preferences']> {
    if (challenges.includes('dyslexia')) {
      return {
        fontFamily: 'OpenDyslexic',
        lineSpacing: INTERVENTION_THRESHOLDS.dyslexiaDefaultLineSpacing,
        ttsSpeed: INTERVENTION_THRESHOLDS.dyslexiaDefaultTtsWpm,
      };
    }
    return {};
  }
}

export default new InterventionEngine();
