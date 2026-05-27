import { EyeMetrics } from '../../types';
import { logger } from '../logger/Logger';

export type FatigueLevel = 'none' | 'moderate' | 'high';

export interface ReadingSessionSnapshot {
  /** Cumulative reading time in the current session (ms). */
  totalDurationMs: number;
  /** Time on the current page (ms). */
  pageDurationMs: number;
  /** Pages completed this session. */
  pagesRead: number;
  /** Latest eye metrics, if eye tracking is active. */
  eyeMetrics?: EyeMetrics;
}

export interface FatigueAssessment {
  level: FatigueLevel;
  /** 0–1 composite fatigue score. */
  score: number;
  /** Recommended brightness multiplier (0.1–1). */
  dimFactor: number;
  reason: string;
}

const DURATION_THRESHOLDS_MS = {
  moderate: 20 * 60 * 1000,
  high: 45 * 60 * 1000,
} as const;

const DIM_FACTORS: Record<FatigueLevel, number> = {
  none: 1,
  moderate: 0.88,
  high: 0.75,
};

class BrightnessFatigueService {
  private sessionStartMs: number | null = null;
  private accumulatedMs = 0;
  private pagesRead = 0;
  private lastAssessment: FatigueAssessment | null = null;

  startSession(): void {
    if (this.sessionStartMs == null) {
      this.sessionStartMs = Date.now();
      logger.debug('BrightnessFatigueService session started');
    }
  }

  endSession(): void {
    if (this.sessionStartMs != null) {
      this.accumulatedMs += Date.now() - this.sessionStartMs;
      this.sessionStartMs = null;
    }
  }

  recordPageComplete(pageDurationMs: number): void {
    this.pagesRead += 1;
    this.accumulatedMs += pageDurationMs;
    logger.debug('BrightnessFatigueService page recorded', {
      pagesRead: this.pagesRead,
      accumulatedMs: this.accumulatedMs,
    });
  }

  getSessionDurationMs(pageDurationMs = 0): number {
    const live = this.sessionStartMs != null ? Date.now() - this.sessionStartMs : 0;
    return this.accumulatedMs + live + pageDurationMs;
  }

  assess(snapshot: ReadingSessionSnapshot): FatigueAssessment {
    const durationScore = this.scoreDuration(snapshot.totalDurationMs);
    const eyeScore = snapshot.eyeMetrics ? this.scoreEyeMetrics(snapshot.eyeMetrics) : 0;
    const composite = Math.min(1, durationScore * 0.55 + eyeScore * 0.45);

    let level: FatigueLevel = 'none';
    if (composite >= 0.72 || snapshot.totalDurationMs >= DURATION_THRESHOLDS_MS.high) {
      level = 'high';
    } else if (composite >= 0.45 || snapshot.totalDurationMs >= DURATION_THRESHOLDS_MS.moderate) {
      level = 'moderate';
    }

    const assessment: FatigueAssessment = {
      level,
      score: composite,
      dimFactor: DIM_FACTORS[level],
      reason: this.buildReason(level, snapshot.totalDurationMs, eyeScore),
    };

    this.lastAssessment = assessment;
    return assessment;
  }

  assessFromMetrics(eyeMetrics?: EyeMetrics): FatigueAssessment {
    const totalDurationMs = this.getSessionDurationMs(eyeMetrics?.timeOnPage ?? 0);
    return this.assess({
      totalDurationMs,
      pageDurationMs: eyeMetrics?.timeOnPage ?? 0,
      pagesRead: this.pagesRead,
      eyeMetrics,
    });
  }

  getLastAssessment(): FatigueAssessment | null {
    return this.lastAssessment;
  }

  resetSession(): void {
    this.sessionStartMs = null;
    this.accumulatedMs = 0;
    this.pagesRead = 0;
    this.lastAssessment = null;
  }

  private scoreDuration(totalMs: number): number {
    if (totalMs >= DURATION_THRESHOLDS_MS.high) {
      return 1;
    }
    if (totalMs >= DURATION_THRESHOLDS_MS.moderate) {
      const span = DURATION_THRESHOLDS_MS.high - DURATION_THRESHOLDS_MS.moderate;
      const progress = (totalMs - DURATION_THRESHOLDS_MS.moderate) / span;
      return 0.5 + progress * 0.5;
    }
    return (totalMs / DURATION_THRESHOLDS_MS.moderate) * 0.5;
  }

  private scoreEyeMetrics(metrics: EyeMetrics): number {
    let score = 0;
    const regressionRate =
      metrics.saccades.length > 0
        ? metrics.regressions.length / metrics.saccades.length
        : metrics.regressions.length > 0
          ? 1
          : 0;

    if (regressionRate > 0.25) score += 0.3;
    else if (regressionRate > 0.15) score += 0.15;

    if (metrics.engagement < 60) score += 0.25;
    if (metrics.fixations.length > 50) score += 0.2;

    const blinkRate =
      metrics.blinkCount != null && metrics.timeOnPage > 0
        ? metrics.blinkCount / (metrics.timeOnPage / 60000)
        : 0;
    if (blinkRate > 20) score += 0.15;

    return Math.min(1, score);
  }

  private buildReason(level: FatigueLevel, totalMs: number, eyeScore: number): string {
    const minutes = Math.round(totalMs / 60000);
    if (level === 'high') {
      return `Extended reading (${minutes} min) — reducing brightness to ease eye strain.`;
    }
    if (level === 'moderate') {
      return eyeScore > 0.3
        ? `Reading fatigue detected after ${minutes} min — gently dimming display.`
        : `You've been reading for ${minutes} min — slightly dimming for comfort.`;
    }
    return 'Comfortable reading session — brightness unchanged.';
  }
}

export default new BrightnessFatigueService();
