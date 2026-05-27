import { ReadingMetrics } from '../../types';
import { logger } from '../logger/Logger';

export interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  totalPages: number;
  averageSpeed: number;
  averageEngagement: number;
  averageComprehension: number;
  totalReadingMinutes: number;
  regressionRate: number;
  highlights: string[];
}

class WeeklyReportService {
  buildReport(metrics: ReadingMetrics[], referenceDate = new Date()): WeeklyReport {
    const end = new Date(referenceDate);
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);

    const weekMetrics = metrics.filter((m) => {
      const ts = new Date(m.timestamp);
      return ts >= start && ts <= end;
    });

    const totalPages = weekMetrics.length;
    const averageSpeed =
      weekMetrics.length > 0
        ? weekMetrics.reduce((sum, m) => sum + m.readingSpeed, 0) / weekMetrics.length
        : 0;
    const averageEngagement =
      weekMetrics.length > 0
        ? weekMetrics.reduce((sum, m) => sum + m.eyeMetrics.engagement, 0) / weekMetrics.length
        : 0;
    const comprehensionScores = weekMetrics.filter((m) => m.comprehensionScore != null);
    const averageComprehension =
      comprehensionScores.length > 0
        ? comprehensionScores.reduce((sum, m) => sum + (m.comprehensionScore ?? 0), 0) /
          comprehensionScores.length
        : 0;
    const totalReadingMinutes =
      weekMetrics.reduce((sum, m) => sum + m.timeSpent, 0) / 60000;
    const totalSaccades = weekMetrics.reduce((sum, m) => sum + m.eyeMetrics.saccades.length, 0);
    const totalRegressions = weekMetrics.reduce(
      (sum, m) => sum + m.eyeMetrics.regressions.length,
      0
    );
    const regressionRate = totalSaccades > 0 ? totalRegressions / totalSaccades : 0;

    const highlights: string[] = [];
    if (averageEngagement >= 80) {
      highlights.push('Strong engagement this week — keep it up!');
    }
    if (averageComprehension >= 75) {
      highlights.push('Comprehension scores are above target.');
    }
    if (totalPages >= 20) {
      highlights.push(`You read ${totalPages} pages this week.`);
    }
    if (regressionRate > 0.2) {
      highlights.push('Consider TTS or guided mode — regressions were elevated.');
    }

    logger.debug('Weekly report generated', { totalPages, averageEngagement });

    return {
      weekStart: start.toISOString().split('T')[0],
      weekEnd: end.toISOString().split('T')[0],
      totalPages,
      averageSpeed: Math.round(averageSpeed),
      averageEngagement: Math.round(averageEngagement),
      averageComprehension: Math.round(averageComprehension),
      totalReadingMinutes: Math.round(totalReadingMinutes),
      regressionRate: Math.round(regressionRate * 100) / 100,
      highlights,
    };
  }

  formatReportCsv(report: WeeklyReport): string {
    return [
      'metric,value',
      `week_start,${report.weekStart}`,
      `week_end,${report.weekEnd}`,
      `total_pages,${report.totalPages}`,
      `avg_speed_wpm,${report.averageSpeed}`,
      `avg_engagement,${report.averageEngagement}`,
      `avg_comprehension,${report.averageComprehension}`,
      `reading_minutes,${report.totalReadingMinutes}`,
      `regression_rate,${report.regressionRate}`,
    ].join('\n');
  }
}

export default new WeeklyReportService();
