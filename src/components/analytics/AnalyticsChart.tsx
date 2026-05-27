import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { AnalyticsData } from '../../types';
import { Text } from '../ui/Text';
import { useTheme } from '../../theme/useTheme';

interface AnalyticsChartProps {
  data: AnalyticsData;
  type: 'speed' | 'engagement' | 'comprehension';
}

function hexWithOpacity(hex: string, opacity: number): string {
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export const AnalyticsChart: React.FC<AnalyticsChartProps> = ({ data, type }) => {
  const { theme } = useTheme();
  const screenWidth = Dimensions.get('window').width;

  const seriesColor =
    type === 'speed'
      ? theme.colors.primary
      : type === 'engagement'
        ? theme.colors.success
        : theme.colors.accent;

  const getChartData = () => {
    switch (type) {
      case 'speed':
        return {
          labels: data.readingSpeed.slice(-7).map((d) => d.date.split('-')[2]),
          datasets: [
            {
              data: data.readingSpeed.slice(-7).map((d) => d.speed),
              color: (opacity = 1) => hexWithOpacity(seriesColor, opacity),
              strokeWidth: 2,
            },
          ],
        };
      case 'engagement':
        return {
          labels: data.engagement.slice(-7).map((d) => d.date.split('-')[2]),
          datasets: [
            {
              data: data.engagement.slice(-7).map((d) => d.engagement),
              color: (opacity = 1) => hexWithOpacity(seriesColor, opacity),
              strokeWidth: 2,
            },
          ],
        };
      case 'comprehension':
        return {
          labels: data.comprehension.slice(-7).map((d) => d.date.split('-')[2]),
          datasets: [
            {
              data: data.comprehension.slice(-7).map((d) => d.score),
              color: (opacity = 1) => hexWithOpacity(seriesColor, opacity),
              strokeWidth: 2,
            },
          ],
        };
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'speed':
        return 'Reading Speed (WPM)';
      case 'engagement':
        return 'Engagement (%)';
      case 'comprehension':
        return 'Comprehension Score (%)';
    }
  };

  const chartData = getChartData();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderSubtle }]}>
      <Text variant="title" style={{ marginBottom: theme.spacing.md }}>
        {getTitle()}
      </Text>
      <LineChart
        data={chartData}
        width={screenWidth - 40}
        height={220}
        chartConfig={{
          backgroundColor: theme.colors.surface,
          backgroundGradientFrom: theme.colors.surface,
          backgroundGradientTo: theme.colors.surfaceMuted,
          decimalPlaces: 0,
          color: (opacity = 1) => hexWithOpacity(seriesColor, opacity),
          labelColor: (opacity = 1) => hexWithOpacity(theme.colors.textSecondary, opacity),
          style: {
            borderRadius: theme.radius.lg,
          },
          propsForDots: {
            r: '4',
            strokeWidth: '2',
            stroke: seriesColor,
          },
        }}
        bezier
        style={styles.chart}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
});
