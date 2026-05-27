import InterventionEngine, { INTERVENTION_THRESHOLDS } from '../src/services/intervention/InterventionEngine';
import { EyeMetrics, UserProfile } from '../src/types';

function makeEyeMetrics(overrides: Partial<EyeMetrics> = {}): EyeMetrics {
  return {
    fixations: [{ x: 100, y: 100, duration: 500, startTime: 0, endTime: 500 }],
    saccades: [
      { startX: 0, startY: 0, endX: 10, endY: 0, duration: 50, velocity: 40, timestamp: 100 },
      { startX: 10, startY: 0, endX: 20, endY: 0, duration: 50, velocity: 40, timestamp: 200 },
    ],
    regressions: [],
    engagement: 70,
    timeOnPage: 10000,
    dwellTime: 8000,
    ...overrides,
  };
}

describe('InterventionEngine', () => {
  it('calculates engagement from fixation time', () => {
    const engagement = InterventionEngine.calculateEngagement(5000, 10000);
    expect(engagement).toBe(50);
  });

  it('returns zero engagement when page time is zero', () => {
    expect(InterventionEngine.calculateEngagement(1000, 0)).toBe(0);
  });

  it('caps engagement at 100', () => {
    expect(InterventionEngine.calculateEngagement(15000, 10000)).toBe(100);
  });

  it('suggests break when engagement is low', () => {
    const metrics = makeEyeMetrics({
      fixations: [{ x: 0, y: 0, duration: 100, startTime: 0, endTime: 100 }],
    });
    const interventions = InterventionEngine.evaluateReadingSession(metrics, null, 10000);
    expect(interventions.some((i) => i.type === 'break_suggestion')).toBe(true);
  });

  it('suggests TTS when regression ratio is high', () => {
    const metrics = makeEyeMetrics({
      saccades: Array.from({ length: 10 }, (_, i) => ({
        startX: i * 10,
        startY: 0,
        endX: i * 10 + 5,
        endY: 0,
        duration: 30,
        velocity: 50,
        timestamp: i * 100,
      })),
      regressions: Array.from({ length: 3 }, (_, i) => ({
        startX: 100,
        startY: 0,
        endX: 50,
        endY: 0,
        duration: 30,
        velocity: 50,
        timestamp: i * 100,
        isRegression: true as const,
      })),
    });
    const interventions = InterventionEngine.evaluateReadingSession(metrics, null, 10000);
    expect(interventions.some((i) => i.type === 'try_tts')).toBe(true);
  });

  it('applies dyslexia profile defaults', () => {
    const defaults = InterventionEngine.getProfileDefaults(['dyslexia']);
    expect(defaults.fontFamily).toBe('OpenDyslexic');
    expect(defaults.lineSpacing).toBe(INTERVENTION_THRESHOLDS.dyslexiaDefaultLineSpacing);
  });

  it('adds self-monitor for ADHD profiles', () => {
    const profile = {
      id: 'u1',
      challenges: ['adhd'],
      preferences: {} as UserProfile['preferences'],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as UserProfile;
    const interventions = InterventionEngine.evaluateReadingSession(makeEyeMetrics(), profile, 10000);
    expect(interventions.some((i) => i.type === 'self_monitor')).toBe(true);
  });
});
