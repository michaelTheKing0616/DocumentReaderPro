import InterventionEngine, { INTERVENTION_THRESHOLDS } from '../src/services/intervention/InterventionEngine';
import { EyeMetrics } from '../src/types';

describe('Accessibility policy checks', () => {
  it('uses evidence-based engagement thresholds', () => {
    expect(INTERVENTION_THRESHOLDS.engagementBreak).toBe(80);
    expect(INTERVENTION_THRESHOLDS.engagementFocusNudge).toBe(60);
    expect(INTERVENTION_THRESHOLDS.dyslexiaDefaultLineSpacing).toBe(1.5);
  });

  it('suggests TTS when regressions exceed 20%', () => {
    const metrics: EyeMetrics = {
      fixations: [{ x: 0, y: 0, duration: 100, startTime: 0, endTime: 100 }],
      saccades: Array.from({ length: 10 }, (_, i) => ({
        startX: 0,
        startY: 0,
        endX: 10,
        endY: 0,
        duration: 50,
        velocity: 40,
        timestamp: i * 100,
      })),
      regressions: Array.from({ length: 3 }, (_, i) => ({
        startX: 100,
        startY: 0,
        endX: 50,
        endY: 0,
        duration: 50,
        velocity: 40,
        timestamp: i * 100,
        isRegression: true as const,
      })),
      engagement: 50,
      timeOnPage: 10000,
      dwellTime: 5000,
    };

    const interventions = InterventionEngine.evaluateReadingSession(metrics, null, 10000);
    expect(interventions.some((item) => item.type === 'try_tts')).toBe(true);
  });
});
