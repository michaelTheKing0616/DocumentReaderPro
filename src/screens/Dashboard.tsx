import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { useSelector } from 'react-redux';
import Share from 'react-native-share';
import * as FileSystem from 'expo-file-system';
import { RootState } from '../redux/store';
import { AnalyticsData } from '../types';
import { AnalyticsChart } from '../components/analytics/AnalyticsChart';
import { Heatmap } from '../components/analytics/Heatmap';
import { GamificationBadge } from '../components/assistive/GamificationBadge';
import DataService from '../services/storage/DataService';
import { MetricsCalculator } from '../services/utils/MetricsCalculator';
import { useTranslation } from '../i18n';
import WeeklyReportService from '../services/analytics/WeeklyReportService';
import LeaderboardService from '../services/gamification/LeaderboardService';
import { logger } from '../services/logger/Logger';
import { Screen } from '../components/ui/Screen';
import { Card } from '../components/ui/Card';
import { Text } from '../components/ui/Text';
import { LottieAnimation } from '../components/ui/LottieAnimation';
import { Button } from '../components/common/Button';
import { useTheme } from '../theme/useTheme';

export const DashboardScreen: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const gamification = useSelector((state: RootState) => state.gamification);
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    readingSpeed: [],
    engagement: [],
    comprehension: [],
    heatmap: [],
  });
  const [insights, setInsights] = useState<string[]>([]);
  const [weeklyReport, setWeeklyReport] = useState<ReturnType<typeof WeeklyReportService.buildReport> | null>(null);
  const [leaderboard, setLeaderboard] = useState<Awaited<ReturnType<typeof LeaderboardService.getTopEntries>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const metrics = await DataService.getReadingMetrics();

      const processed: AnalyticsData = {
        readingSpeed: metrics.map((m) => ({
          date: m.timestamp.toISOString().split('T')[0],
          speed: m.readingSpeed,
        })),
        engagement: metrics.map((m) => ({
          date: m.timestamp.toISOString().split('T')[0],
          engagement: m.eyeMetrics.engagement,
        })),
        comprehension: metrics.map((m) => ({
          date: m.timestamp.toISOString().split('T')[0],
          score: m.comprehensionScore || 0,
        })),
        heatmap: metrics.flatMap((m) =>
          m.eyeMetrics.fixations.map((f) => ({
            x: f.x,
            y: f.y,
            intensity: f.duration / 1000,
          }))
        ),
      };

      setAnalytics(processed);

      const aggregated = MetricsCalculator.aggregateMetrics(metrics);
      const newInsights: string[] = [];

      if (aggregated.averageEngagement < 60) {
        newInsights.push(t('dashboard.insightLowEngagement'));
      }

      if (aggregated.averageComprehension < 70) {
        newInsights.push(t('dashboard.insightLowComprehension'));
      }

      const recentMetrics = metrics.slice(-10);
      const avgRegressions =
        recentMetrics.reduce((sum, m) => sum + m.eyeMetrics.regressions.length, 0) /
        recentMetrics.length;

      if (avgRegressions > 20) {
        newInsights.push(t('dashboard.insightHighRegressions'));
      }

      setInsights(newInsights);
      setWeeklyReport(WeeklyReportService.buildReport(metrics));
      const top = await LeaderboardService.getTopEntries(5);
      setLeaderboard(top);
    } catch (error) {
      logger.error('Error loading analytics', {
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = async () => {
    try {
      const metrics = await DataService.getReadingMetrics();
      const header = 'date,documentId,page,speed,engagement,comprehension,regressions';
      const rows = metrics.map((m) =>
        [
          new Date(m.timestamp).toISOString(),
          m.documentId,
          m.pageNumber,
          m.readingSpeed,
          m.eyeMetrics.engagement,
          m.comprehensionScore ?? '',
          m.eyeMetrics.regressions.length,
        ].join(',')
      );
      const csv = [header, ...rows].join('\n');
      const path = `${FileSystem.cacheDirectory}readassist_analytics_${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });

      await Share.open({
        title: 'ReadAssist Analytics',
        url: path,
        type: 'text/csv',
        failOnCancel: false,
      });
      logger.info('Analytics CSV exported', { rows: rows.length });
    } catch (error) {
      logger.error('CSV export failed', {
        message: error instanceof Error ? error.message : String(error),
      });
      Alert.alert(t('dashboard.exportError'));
    }
  };

  const exportWeeklyReport = async () => {
    if (!weeklyReport) {
      return;
    }
    try {
      const csv = WeeklyReportService.formatReportCsv(weeklyReport);
      const path = `${FileSystem.cacheDirectory}readassist_weekly_${weeklyReport.weekStart}.csv`;
      await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
      await Share.open({ title: 'Weekly Report', url: path, type: 'text/csv', failOnCancel: false });
    } catch {
      Alert.alert(t('dashboard.exportError'));
    }
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <LottieAnimation preset="loading" size={100} />
          <Text variant="body" color="secondary" style={{ marginTop: theme.spacing.lg }}>
            {t('dashboard.loadingAnalytics')}
          </Text>
        </View>
      </Screen>
    );
  }

  const hasData =
    analytics.readingSpeed.length > 0 ||
    gamification.points > 0 ||
    insights.length > 0;

  return (
    <Screen padded={false}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { padding: theme.spacing.lg }]}
      >
        <Text variant="title" style={{ marginBottom: theme.spacing['2xl'] }}>
          {t('dashboard.title')}
        </Text>

        {!hasData && (
          <Card style={{ marginBottom: theme.spacing.lg, alignItems: 'center' }}>
            <LottieAnimation preset="empty" size={80} />
            <Text variant="body" color="secondary" style={{ textAlign: 'center', marginTop: theme.spacing.md }}>
              Start reading to see your analytics here.
            </Text>
          </Card>
        )}

        <Card style={{ marginBottom: theme.spacing.lg }}>
          <Text variant="title" style={{ fontSize: 18, marginBottom: theme.spacing.md }}>
            {t('dashboard.progress')}
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text variant="title" color="accent">
                {gamification.points}
              </Text>
              <Text variant="caption" color="muted">
                {t('dashboard.points')}
              </Text>
            </View>
            <View style={styles.statBox}>
              <Text variant="title" color="accent">
                {gamification.level}
              </Text>
              <Text variant="caption" color="muted">
                {t('dashboard.level')}
              </Text>
            </View>
            <View style={styles.statBox}>
              <Text variant="title" color="accent">
                {gamification.streaks.current}
              </Text>
              <Text variant="caption" color="muted">
                {t('dashboard.streak')}
              </Text>
            </View>
          </View>

          {gamification.badges.length > 0 && (
            <View style={{ marginTop: theme.spacing.lg }}>
              <Text variant="label" color="muted" style={{ marginBottom: theme.spacing.sm }}>
                {t('dashboard.badges')}
              </Text>
              <View style={styles.badgesRow}>
                {gamification.badges.map((badge) => (
                  <GamificationBadge key={badge.id} badge={badge} size="small" />
                ))}
              </View>
            </View>
          )}
        </Card>

        {weeklyReport && (
          <Card style={{ marginBottom: theme.spacing.lg }}>
            <Text variant="title" style={{ fontSize: 18, marginBottom: theme.spacing.md }}>
              {t('dashboard.weeklyReport')}
            </Text>
            <Text variant="caption" color="muted" style={{ marginBottom: theme.spacing.md }}>
              {weeklyReport.weekStart} — {weeklyReport.weekEnd}
            </Text>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text variant="title" color="accent">
                  {weeklyReport.totalPages}
                </Text>
                <Text variant="caption" color="muted">
                  {t('dashboard.pages')}
                </Text>
              </View>
              <View style={styles.statBox}>
                <Text variant="title" color="accent">
                  {weeklyReport.averageEngagement}%
                </Text>
                <Text variant="caption" color="muted">
                  {t('dashboard.engagement')}
                </Text>
              </View>
              <View style={styles.statBox}>
                <Text variant="title" color="accent">
                  {weeklyReport.totalReadingMinutes}m
                </Text>
                <Text variant="caption" color="muted">
                  {t('dashboard.reading')}
                </Text>
              </View>
            </View>
            {weeklyReport.highlights.map((line, index) => (
              <Text key={index} variant="body" color="secondary" style={{ marginBottom: theme.spacing.sm }}>
                • {line}
              </Text>
            ))}
            <Button
              title={t('dashboard.exportWeeklyCsv')}
              variant="secondary"
              onPress={() => void exportWeeklyReport()}
              fullWidth
              style={{ marginTop: theme.spacing.md }}
            />
          </Card>
        )}

        {leaderboard.length > 0 && (
          <Card style={{ marginBottom: theme.spacing.lg }}>
            <Text variant="title" style={{ fontSize: 18, marginBottom: theme.spacing.md }}>
              {t('dashboard.leaderboard')}
            </Text>
            {leaderboard.map((entry) => (
              <View
                key={entry.userId}
                style={[styles.leaderRow, { borderBottomColor: theme.colors.borderSubtle }]}
              >
                <Text variant="label" color="accent" style={styles.leaderRank}>
                  #{entry.rank}
                </Text>
                <Text variant="body" style={styles.leaderName}>
                  {entry.displayName}
                </Text>
                <Text variant="caption" color="muted">
                  {entry.points} pts
                </Text>
              </View>
            ))}
          </Card>
        )}

        {insights.length > 0 && (
          <View style={{ marginBottom: theme.spacing.lg }}>
            <Text variant="title" style={{ fontSize: 18, marginBottom: theme.spacing.md }}>
              {t('dashboard.insights')}
            </Text>
            {insights.map((insight, index) => (
              <Card
                key={index}
                muted
                style={{
                  marginBottom: theme.spacing.sm,
                  borderLeftWidth: 4,
                  borderLeftColor: theme.colors.warning,
                  backgroundColor: theme.colors.warningMuted,
                }}
              >
                <Text variant="body" color="secondary">
                  {insight}
                </Text>
              </Card>
            ))}
          </View>
        )}

        <View style={{ marginBottom: theme.spacing.lg }}>
          <Text variant="title" style={{ fontSize: 18, marginBottom: theme.spacing.md }}>
            {t('dashboard.analytics')}
          </Text>
          <AnalyticsChart data={analytics} type="speed" />
          <AnalyticsChart data={analytics} type="engagement" />
          <AnalyticsChart data={analytics} type="comprehension" />
          <Heatmap data={analytics} />
        </View>

        <Button title={t('dashboard.exportCsv')} onPress={() => void exportCsv()} fullWidth />
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: 32 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statBox: { alignItems: 'center' },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap' },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  leaderRank: { width: 36 },
  leaderName: { flex: 1 },
});
