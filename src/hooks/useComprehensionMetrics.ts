import { useState, useCallback } from 'react';
import { EyeMetrics, ComprehensionMetric } from '../types';
import ComprehensionMetricService from '../services/ai/ComprehensionMetricService';

export const useComprehensionMetrics = () => {
  const [currentMetric, setCurrentMetric] = useState<ComprehensionMetric | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Predict comprehension from eye metrics
  const predictComprehension = useCallback(async (eyeMetrics: EyeMetrics) => {
    setIsCalculating(true);
    try {
      const metric = await ComprehensionMetricService.predictComprehension(eyeMetrics);
      setCurrentMetric(metric);
      return metric;
    } catch (error) {
      console.error('Comprehension prediction error:', error);
      return null;
    } finally {
      setIsCalculating(false);
    }
  }, []);

  // Clear current metric
  const clearMetric = useCallback(() => {
    setCurrentMetric(null);
  }, []);

  return {
    currentMetric,
    isCalculating,
    predictComprehension,
    clearMetric,
  };
};

