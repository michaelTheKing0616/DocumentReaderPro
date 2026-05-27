import { EyeMetrics, ReadingMetrics } from '../../types';

export class MetricsCalculator {
  // Calculate reading speed (words per minute)
  static calculateReadingSpeed(
    wordCount: number,
    timeSpent: number // milliseconds
  ): number {
    if (timeSpent === 0) return 0;
    const minutes = timeSpent / 60000;
    return Math.round(wordCount / minutes);
  }

  // Calculate engagement percentage
  static calculateEngagement(eyeMetrics: EyeMetrics): number {
    if (eyeMetrics.timeOnPage === 0) return 0;
    const fixationTime = eyeMetrics.fixations.reduce(
      (sum, f) => sum + f.duration,
      0
    );
    return Math.round((fixationTime / eyeMetrics.timeOnPage) * 100);
  }

  // Calculate regression percentage
  static calculateRegressionPercentage(
    eyeMetrics: EyeMetrics,
    lineWidth: number
  ): number {
    if (eyeMetrics.saccades.length === 0) return 0;
    const regressions = eyeMetrics.regressions.length;
    return Math.round((regressions / eyeMetrics.saccades.length) * 100);
  }

  // Calculate average fixation duration
  static calculateAverageFixationDuration(eyeMetrics: EyeMetrics): number {
    if (eyeMetrics.fixations.length === 0) return 0;
    const totalDuration = eyeMetrics.fixations.reduce(
      (sum, f) => sum + f.duration,
      0
    );
    return Math.round(totalDuration / eyeMetrics.fixations.length);
  }

  // Calculate comprehension score from metrics
  static estimateComprehension(eyeMetrics: EyeMetrics): number {
    let score = 70; // Base score

    // Fewer regressions = better comprehension
    const regressionPenalty = Math.min(eyeMetrics.regressions.length * 2, 20);
    score -= regressionPenalty;

    // Higher engagement = better comprehension
    const engagementBonus = (eyeMetrics.engagement - 60) * 0.3;
    score += engagementBonus;

    // Moderate fixation count is best
    const fixationCount = eyeMetrics.fixations.length;
    if (fixationCount < 10) {
      score -= 10;
    } else if (fixationCount > 50) {
      score -= 5;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  // Aggregate reading metrics
  static aggregateMetrics(
    metrics: ReadingMetrics[]
  ): {
    averageSpeed: number;
    averageEngagement: number;
    averageComprehension: number;
    totalTime: number;
  } {
    if (metrics.length === 0) {
      return {
        averageSpeed: 0,
        averageEngagement: 0,
        averageComprehension: 0,
        totalTime: 0,
      };
    }

    const totalSpeed = metrics.reduce((sum, m) => sum + m.readingSpeed, 0);
    const totalEngagement = metrics.reduce(
      (sum, m) => sum + m.eyeMetrics.engagement,
      0
    );
    const totalComprehension = metrics.reduce(
      (sum, m) => sum + (m.comprehensionScore || 0),
      0
    );
    const totalTime = metrics.reduce((sum, m) => sum + m.timeSpent, 0);

    return {
      averageSpeed: Math.round(totalSpeed / metrics.length),
      averageEngagement: Math.round(totalEngagement / metrics.length),
      averageComprehension: Math.round(totalComprehension / metrics.length),
      totalTime,
    };
  }
}

