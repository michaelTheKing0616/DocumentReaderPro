import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ComprehensionMetric } from '../../types';

interface ComprehensionMetricDisplayProps {
  metric: ComprehensionMetric;
  showDetails?: boolean;
}

export const ComprehensionMetricDisplay: React.FC<ComprehensionMetricDisplayProps> = ({
  metric,
  showDetails = false,
}) => {
  const getScoreColor = (score: number) => {
    if (score >= 80) return '#4CAF50';
    if (score >= 60) return '#FF9800';
    return '#F44336';
  };

  return (
    <View style={styles.container}>
      <View style={styles.scoreContainer}>
        <Text style={styles.scoreLabel}>Comprehension</Text>
        <Text style={[styles.score, { color: getScoreColor(metric.score) }]}>
          {metric.score}%
        </Text>
        <Text style={styles.confidence}>
          Confidence: {Math.round(metric.confidence * 100)}%
        </Text>
      </View>
      {showDetails && (
        <View style={styles.detailsContainer}>
          <Text style={styles.detailsTitle}>Factors:</Text>
          <Text style={styles.detailText}>
            Regressions: {metric.factors.regressions}
          </Text>
          <Text style={styles.detailText}>
            Fixations: {metric.factors.fixations}
          </Text>
          <Text style={styles.detailText}>
            Engagement: {Math.round(metric.factors.engagement)}%
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scoreContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  scoreLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  score: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  confidence: {
    fontSize: 12,
    color: '#999999',
  },
  detailsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 12,
  },
  detailsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
});

