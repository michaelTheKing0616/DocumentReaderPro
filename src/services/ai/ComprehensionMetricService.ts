import * as tf from '@tensorflow/tfjs';
import { EyeMetrics, ComprehensionMetric } from '../../types';
import { logger } from '../logger/Logger';

const FEATURE_VECTOR_SIZE = 6;
const BASE_RULE_SCORE = 70;
const MAX_REGRESSION_PENALTY = 20;
const ENGAGEMENT_BASELINE = 60;

class ComprehensionMetricService {
  private model: tf.LayersModel | null = null;
  private initialized = false;

  async initializeModel(): Promise<void> {
    if (this.initialized && this.model) {
      return;
    }

    await tf.ready();
    this.model = this.createFeatureVectorModel();
    this.initialized = true;
    logger.debug('ComprehensionMetricService model initialized', {
      featureVectorSize: FEATURE_VECTOR_SIZE,
    });
  }

  async predictComprehension(eyeMetrics: EyeMetrics): Promise<ComprehensionMetric> {
    await this.initializeModel();

    if (!this.model) {
      return this.ruleBasedPrediction(eyeMetrics);
    }

    const features = this.extractFeatureVector(eyeMetrics);
    const input = tf.tensor2d([features]);
    const prediction = this.model.predict(input) as tf.Tensor;
    const scoreRaw = (await prediction.data())[0];
    const score = Math.round(Math.max(0, Math.min(100, scoreRaw * 100)));
    const confidence = this.estimateConfidence(eyeMetrics);

    input.dispose();
    prediction.dispose();

    return {
      score,
      confidence,
      factors: this.buildFactors(eyeMetrics),
      timestamp: new Date(),
    };
  }

  private createFeatureVectorModel(): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [FEATURE_VECTOR_SIZE],
          units: 16,
          activation: 'relu',
        }),
        tf.layers.dense({ units: 8, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' }),
      ],
    });

    model.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError',
    });

    return model;
  }

  private extractFeatureVector(eyeMetrics: EyeMetrics): number[] {
    const fixationCount = eyeMetrics.fixations.length;
    const saccadeCount = eyeMetrics.saccades.length;
    const regressionCount = eyeMetrics.regressions.length;
    const avgFixationDuration =
      fixationCount > 0
        ? eyeMetrics.fixations.reduce((sum, fixation) => sum + fixation.duration, 0) /
          fixationCount
        : 0;
    const dwellRatio =
      eyeMetrics.timeOnPage > 0 ? eyeMetrics.dwellTime / eyeMetrics.timeOnPage : 0;

    return [
      regressionCount / 10,
      fixationCount / 50,
      saccadeCount / 80,
      eyeMetrics.engagement / 100,
      dwellRatio,
      avgFixationDuration / 500,
    ];
  }

  private estimateConfidence(eyeMetrics: EyeMetrics): number {
    const sampleFactor = Math.min(eyeMetrics.fixations.length / 20, 1);
    return Math.round((0.5 + sampleFactor * 0.4) * 100) / 100;
  }

  private ruleBasedPrediction(eyeMetrics: EyeMetrics): ComprehensionMetric {
    let score = BASE_RULE_SCORE;

    const regressionPenalty = Math.min(eyeMetrics.regressions.length * 2, MAX_REGRESSION_PENALTY);
    score -= regressionPenalty;

    const engagementBonus = (eyeMetrics.engagement - ENGAGEMENT_BASELINE) * 0.3;
    score += engagementBonus;

    const fixationCount = eyeMetrics.fixations.length;
    if (fixationCount < 10) {
      score -= 10;
    } else if (fixationCount > 50) {
      score -= 5;
    }

    score = Math.max(0, Math.min(100, score));

    return {
      score: Math.round(score),
      confidence: 0.6,
      factors: this.buildFactors(eyeMetrics),
      timestamp: new Date(),
    };
  }

  private buildFactors(eyeMetrics: EyeMetrics) {
    return {
      regressions: eyeMetrics.regressions.length,
      fixations: eyeMetrics.fixations.length,
      readingSpeed: 0,
      engagement: eyeMetrics.engagement,
    };
  }
}

export default new ComprehensionMetricService();
