import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  GazePoint,
  Fixation,
  Saccade,
  Regression,
  EyeMetrics,
  CalibrationResult,
  CalibrationMethod,
  CalibrationPoint,
  HardwareType,
} from '../../types';
import { getScreenDimensions } from '../../utils/dimensions';
import { logger } from '../logger/Logger';
import { GazeCallback, GazeSource } from './GazeSource';
import HardwareGazeAdapter from '../hardware/HardwareGazeAdapter';
import { CalibrationUtils } from './CalibrationUtils';
import NeuralGazePredictor from './NeuralGazePredictor';

const DEFAULT_SAMPLE_RATE_HZ = 30;
const PIXELS_PER_DEGREE = 60;
const LOW_ENGAGEMENT_THRESHOLD = 60;
const CALIBRATION_STORAGE_KEY = '@readassist/eye-calibration-v1';

interface PersistedCalibration {
  transform: CalibrationUtils.AffineTransform;
  result: CalibrationResult;
}

export interface EyeTrackingOptions {
  hardwareType?: HardwareType;
  sampleRateHz?: number;
  enableNeuralPrediction?: boolean;
}

class EyeService {
  private gazePoints: GazePoint[] = [];
  private isTracking = false;
  private gazeSource: GazeSource | null = null;
  private gazeCallback: GazeCallback | null = null;
  private calibrationTransform: CalibrationUtils.AffineTransform | null = null;
  private calibrationCaptureCallback: GazeCallback | null = null;
  private preferredHardware: HardwareType = 'none';

  async loadPersistedCalibration(): Promise<CalibrationResult | null> {
    try {
      const raw = await AsyncStorage.getItem(CALIBRATION_STORAGE_KEY);
      if (!raw) {
        return null;
      }

      const persisted = JSON.parse(raw) as PersistedCalibration;
      this.calibrationTransform = persisted.transform;
      logger.info('EyeService loaded persisted calibration', {
        accuracy: persisted.result.accuracy,
      });
      return persisted.result;
    } catch (error) {
      logger.warn('EyeService failed to load calibration', { error: String(error) });
      return null;
    }
  }

  async saveCalibration(result: CalibrationResult): Promise<void> {
    if (!this.calibrationTransform) {
      return;
    }

    const payload: PersistedCalibration = {
      transform: this.calibrationTransform,
      result,
    };

    try {
      await AsyncStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(payload));
      logger.info('EyeService calibration saved', { accuracy: result.accuracy });
    } catch (error) {
      logger.error('EyeService failed to save calibration', { error: String(error) });
    }
  }

  async clearPersistedCalibration(): Promise<void> {
    this.calibrationTransform = null;
    await AsyncStorage.removeItem(CALIBRATION_STORAGE_KEY);
  }

  setPreferredHardware(type: HardwareType): void {
    this.preferredHardware = type;
    HardwareGazeAdapter.setPreferredHardware(type);
  }

  getPreferredHardware(): HardwareType {
    return this.preferredHardware;
  }

  async startTracking(
    onGazePoint: (point: GazePoint) => void,
    options: EyeTrackingOptions = {}
  ): Promise<boolean> {
    if (this.isTracking) {
      return true;
    }

    const hardwareType = options.hardwareType ?? this.preferredHardware;
    this.gazeCallback = onGazePoint;
    this.gazeSource = this.resolveGazeSource(hardwareType);

    const started = await this.gazeSource.start(
      (rawPoint) => {
        const point = this.applyCalibration(rawPoint);
        this.gazePoints.push(point);
        this.gazeCallback?.(point);
        this.calibrationCaptureCallback?.(rawPoint);

        if (options.enableNeuralPrediction) {
          NeuralGazePredictor.addGazePoint(point);
        }
      },
      { sampleRateHz: options.sampleRateHz ?? DEFAULT_SAMPLE_RATE_HZ }
    );

    this.isTracking = started;
    if (started) {
      logger.info('EyeService tracking started', { sourceId: this.gazeSource.id });
    } else {
      logger.warn('EyeService tracking failed to start', { hardwareType });
    }
    return started;
  }

  /** Stream raw gaze samples for calibration dot collection. */
  async startCalibrationCapture(hardwareType?: HardwareType): Promise<boolean> {
    if (!this.isTracking) {
      const started = await this.startTracking(() => undefined, { hardwareType });
      if (!started) {
        return false;
      }
    }

    this.calibrationCaptureSamples = [];
    this.calibrationCaptureCallback = (point) => {
      this.calibrationCaptureSamples.push(point);
    };
    return true;
  }

  private calibrationCaptureSamples: GazePoint[] = [];

  resetCalibrationSamples(): void {
    this.calibrationCaptureSamples = [];
  }

  /** Median gaze over samples collected since last reset. */
  getCalibrationSampleMedian(): { gazeX: number; gazeY: number } | null {
    const samples = this.calibrationCaptureSamples;
    if (samples.length === 0) {
      return null;
    }

    const xs = [...samples.map((p) => p.x)].sort((a, b) => a - b);
    const ys = [...samples.map((p) => p.y)].sort((a, b) => a - b);
    const mid = Math.floor(samples.length / 2);

    return {
      gazeX: xs[mid],
      gazeY: ys[mid],
    };
  }

  stopCalibrationCapture(): void {
    this.calibrationCaptureCallback = null;
    this.calibrationCaptureSamples = [];
    this.stopTracking();
  }

  stopTracking(): void {
    if (this.gazeSource) {
      this.gazeSource.stop();
      this.gazeSource = null;
    }
    this.isTracking = false;
    this.gazeCallback = null;
    this.calibrationCaptureCallback = null;
    NeuralGazePredictor.clearHistory();
    logger.debug('EyeService tracking stopped');
  }

  getGazePoints(): GazePoint[] {
    return [...this.gazePoints];
  }

  clearGazePoints(): void {
    this.gazePoints = [];
  }

  isActive(): boolean {
    return this.isTracking;
  }

  detectFixations(
    gazePoints: GazePoint[],
    config = { dispersionThreshold: 1, durationThreshold: 100 }
  ): Fixation[] {
    const fixations: Fixation[] = [];
    let windowStart = 0;

    for (let i = 1; i < gazePoints.length; i++) {
      const window = gazePoints.slice(windowStart, i + 1);
      const dispersion = this.calculateDispersion(window);
      const dispersionDegrees = dispersion / PIXELS_PER_DEGREE;

      if (dispersionDegrees > config.dispersionThreshold) {
        const duration = window[window.length - 1].timestamp - window[0].timestamp;
        if (duration >= config.durationThreshold && window.length > 1) {
          const center = this.calculateCenter(window);
          fixations.push({
            x: center.x,
            y: center.y,
            duration,
            startTime: window[0].timestamp,
            endTime: window[window.length - 1].timestamp,
          });
        }
        windowStart = i;
      }
    }

    return fixations;
  }

  detectSaccades(gazePoints: GazePoint[], config = { velocityThreshold: 30 }): Saccade[] {
    const saccades: Saccade[] = [];

    for (let i = 1; i < gazePoints.length; i++) {
      const prev = gazePoints[i - 1];
      const curr = gazePoints[i];
      const dt = (curr.timestamp - prev.timestamp) / 1000;

      if (dt === 0) {
        continue;
      }

      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const distanceDegrees = distance / PIXELS_PER_DEGREE;
      const velocity = distanceDegrees / dt;

      if (velocity > config.velocityThreshold) {
        saccades.push({
          startX: prev.x,
          startY: prev.y,
          endX: curr.x,
          endY: curr.y,
          duration: curr.timestamp - prev.timestamp,
          velocity,
          timestamp: curr.timestamp,
        });
      }
    }

    return saccades;
  }

  detectRegressions(saccades: Saccade[], lineWidth: number): Regression[] {
    const regressions: Regression[] = [];

    for (const saccade of saccades) {
      const horizontalDistance = saccade.endX - saccade.startX;
      const percentage = (Math.abs(horizontalDistance) / lineWidth) * 100;

      if (horizontalDistance < 0 && percentage > 10) {
        regressions.push({
          ...saccade,
          isRegression: true,
        });
      }
    }

    return regressions;
  }

  calculateEngagement(eyeMetrics: EyeMetrics): number {
    if (eyeMetrics.timeOnPage <= 0) {
      return 0;
    }
    const fixationTime = eyeMetrics.fixations.reduce((sum, f) => sum + f.duration, 0);
    return (fixationTime / eyeMetrics.timeOnPage) * 100;
  }

  calculateMetrics(
    gazePoints: GazePoint[],
    timeOnPage: number,
    lineWidth: number,
    dwellTime = 0
  ): EyeMetrics {
    const fixations = this.detectFixations(gazePoints);
    const saccades = this.detectSaccades(gazePoints);
    const regressions = this.detectRegressions(saccades, lineWidth);

    const metrics: EyeMetrics = {
      fixations,
      saccades,
      regressions,
      engagement: 0,
      timeOnPage,
      dwellTime,
    };

    metrics.engagement = this.calculateEngagement(metrics);
    return metrics;
  }

  isLowEngagement(metrics: EyeMetrics): boolean {
    return metrics.engagement < LOW_ENGAGEMENT_THRESHOLD;
  }

  async calibrate(
    method: CalibrationMethod,
    collectedPoints: CalibrationPoint[] = []
  ): Promise<CalibrationResult> {
    const points =
      collectedPoints.length > 0
        ? collectedPoints
        : CalibrationUtils.generateGridPoints(9);

    const accuracy = CalibrationUtils.calculateAccuracy(points, method);
    const transform = CalibrationUtils.buildAffineTransform(points);
    this.calibrationTransform = transform;

    const result: CalibrationResult = {
      method,
      points,
      accuracy,
      completed: CalibrationUtils.validateCalibration({
        method,
        points,
        accuracy,
        completed: true,
      }),
    };

    if (result.completed) {
      await this.saveCalibration(result);
    }

    logger.info('EyeService calibration complete', {
      method,
      accuracy,
      completed: result.completed,
    });

    return result;
  }

  getCalibrationTransform(): CalibrationUtils.AffineTransform | null {
    return this.calibrationTransform;
  }

  private resolveGazeSource(hardwareType: HardwareType): GazeSource {
    if (hardwareType === 'none' && Platform.OS === 'web') {
      return HardwareGazeAdapter.resolveSource('webgazer');
    }
    return HardwareGazeAdapter.resolveSource(hardwareType);
  }

  private applyCalibration(point: GazePoint): GazePoint {
    if (!this.calibrationTransform) {
      return point;
    }

    const { x, y } = CalibrationUtils.applyAffineTransform(point, this.calibrationTransform);
    const { width, height } = getScreenDimensions();

    return {
      x: Math.max(0, Math.min(width, x)),
      y: Math.max(0, Math.min(height, y)),
      timestamp: point.timestamp,
    };
  }

  private calculateDispersion(points: GazePoint[]): number {
    if (points.length < 2) {
      return 0;
    }

    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    return Math.max(maxX - minX, maxY - minY);
  }

  private calculateCenter(points: GazePoint[]): { x: number; y: number } {
    const sumX = points.reduce((sum, p) => sum + p.x, 0);
    const sumY = points.reduce((sum, p) => sum + p.y, 0);
    return {
      x: sumX / points.length,
      y: sumY / points.length,
    };
  }
}

const eyeService = new EyeService();
void eyeService.loadPersistedCalibration();

export default eyeService;
