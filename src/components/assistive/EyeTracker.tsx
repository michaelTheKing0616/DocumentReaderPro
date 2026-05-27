import React, { useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useSelector } from 'react-redux';
import { useEyeTracking } from '../../hooks/useEyeTracking';
import { EyeMetrics } from '../../types';
import { RootState } from '../../redux/store';

interface EyeTrackerProps {
  enabled: boolean;
  onMetricsUpdate?: (metrics: EyeMetrics) => void;
  onLowEngagement?: () => void;
  lineWidth?: number;
  showVisualization?: boolean;
}

export const EyeTracker: React.FC<EyeTrackerProps> = ({
  enabled,
  onMetricsUpdate,
  onLowEngagement,
  lineWidth = 800,
  showVisualization = false,
}) => {
  const hardwareType = useSelector((state: RootState) => state.settings.hardwareType);
  const { gazePoints, metrics, isTracking, startTracking, stopTracking } = useEyeTracking({
    enabled,
    onMetricsUpdate,
    onLowEngagement,
    lineWidth,
    hardwareType,
  });

  useEffect(() => {
    if (enabled) {
      startTracking();
    } else {
      stopTracking();
    }
  }, [enabled, startTracking, stopTracking]);

  if (!showVisualization) {
    return null;
  }

  return (
    <View style={styles.container}>
      {metrics && (
        <View style={styles.metricsContainer}>
          <Text style={styles.metricText}>
            Engagement: {Math.round(metrics.engagement)}%
          </Text>
          <Text style={styles.metricText}>
            Fixations: {metrics.fixations.length}
          </Text>
          <Text style={styles.metricText}>
            Regressions: {metrics.regressions.length}
          </Text>
        </View>
      )}
      {gazePoints.length > 0 && showVisualization && (
        <View
          style={[
            styles.gazeIndicator,
            {
              left: gazePoints[gazePoints.length - 1].x - 10,
              top: gazePoints[gazePoints.length - 1].y - 10,
            },
          ]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  metricsContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 4,
  },
  metricText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginBottom: 4,
  },
  gazeIndicator: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 0, 0, 0.5)',
    borderWidth: 2,
    borderColor: '#FF0000',
  },
});

