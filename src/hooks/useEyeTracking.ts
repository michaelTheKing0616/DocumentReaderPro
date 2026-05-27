import { useState, useEffect, useCallback, useRef } from 'react';
import { GazePoint, EyeMetrics, CalibrationResult, HardwareType, CalibrationPoint } from '../types';
import EyeService from '../services/eye/EyeService';
import AutoScrollController from '../services/eye/AutoScrollController';
import NeuralGazePredictor from '../services/eye/NeuralGazePredictor';
import { CalibrationUtils } from '../services/eye/CalibrationUtils';
import { logger } from '../services/logger/Logger';

interface UseEyeTrackingOptions {
  enabled: boolean;
  onMetricsUpdate?: (metrics: EyeMetrics) => void;
  onLowEngagement?: () => void;
  onPredictedGaze?: (point: GazePoint) => void;
  lineWidth?: number;
  hardwareType?: HardwareType;
  autoScroll?: boolean;
  onAutoScroll?: (deltaY: number) => void;
  enableNeuralPrediction?: boolean;
}

const METRICS_SAMPLE_INTERVAL_MS = 500;
const LOW_ENGAGEMENT_DELAY_MS = 10000;

export const useEyeTracking = (options: UseEyeTrackingOptions) => {
  const {
    enabled,
    onMetricsUpdate,
    onLowEngagement,
    onPredictedGaze,
    lineWidth = 800,
    hardwareType = 'none',
    autoScroll = false,
    onAutoScroll,
    enableNeuralPrediction = false,
  } = options;

  const [gazePoints, setGazePoints] = useState<GazePoint[]>([]);
  const [metrics, setMetrics] = useState<EyeMetrics | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [calibration, setCalibration] = useState<CalibrationResult | null>(null);
  const [predictedGaze, setPredictedGaze] = useState<GazePoint | null>(null);

  const startTimeRef = useRef<number>(Date.now());
  const lastScrollYRef = useRef<number>(0);
  const lowEngagementTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const metricsIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const gazePointsRef = useRef<GazePoint[]>([]);

  useEffect(() => {
    EyeService.setPreferredHardware(hardwareType);
    void EyeService.loadPersistedCalibration().then((result) => {
      if (result) {
        setCalibration(result);
      }
    });
  }, [hardwareType]);

  const startTracking = useCallback(async () => {
    if (isTracking || !enabled) {
      return;
    }

    startTimeRef.current = Date.now();
    lastScrollYRef.current = 0;
    gazePointsRef.current = [];
    setGazePoints([]);
    setPredictedGaze(null);

    if (autoScroll && onAutoScroll) {
      AutoScrollController.enable(onAutoScroll);
    }

    const started = await EyeService.startTracking(
      (point) => {
        gazePointsRef.current = [...gazePointsRef.current, point];
        setGazePoints(gazePointsRef.current);

        if (autoScroll) {
          AutoScrollController.handleGazePoint(point);
        }

        if (enableNeuralPrediction && NeuralGazePredictor.hasEnoughHistory()) {
          void NeuralGazePredictor.predictNextGaze().then((prediction) => {
            if (prediction) {
              setPredictedGaze(prediction);
              onPredictedGaze?.(prediction);
            }
          });
        }
      },
      {
        hardwareType,
        enableNeuralPrediction,
      }
    );

    setIsTracking(started);
    if (!started) {
      logger.warn('useEyeTracking failed to start gaze pipeline');
    }
  }, [
    autoScroll,
    enabled,
    enableNeuralPrediction,
    hardwareType,
    isTracking,
    onAutoScroll,
    onPredictedGaze,
  ]);

  const stopTracking = useCallback(() => {
    if (!isTracking) {
      return;
    }

    EyeService.stopTracking();
    AutoScrollController.disable();
    setIsTracking(false);

    if (metricsIntervalRef.current) {
      clearInterval(metricsIntervalRef.current);
      metricsIntervalRef.current = undefined;
    }
  }, [isTracking]);

  const updateMetrics = useCallback(() => {
    const points = gazePointsRef.current;
    if (points.length === 0 || !isTracking) {
      return;
    }

    const timeOnPage = Date.now() - startTimeRef.current;
    const dwellTime = Math.max(0, timeOnPage - lastScrollYRef.current);
    const calculatedMetrics = EyeService.calculateMetrics(
      points,
      timeOnPage,
      lineWidth,
      dwellTime
    );

    setMetrics(calculatedMetrics);
    onMetricsUpdate?.(calculatedMetrics);

    if (EyeService.isLowEngagement(calculatedMetrics)) {
      if (!lowEngagementTimeoutRef.current) {
        lowEngagementTimeoutRef.current = setTimeout(() => {
          onLowEngagement?.();
          lowEngagementTimeoutRef.current = undefined;
        }, LOW_ENGAGEMENT_DELAY_MS);
      }
    } else if (lowEngagementTimeoutRef.current) {
      clearTimeout(lowEngagementTimeoutRef.current);
      lowEngagementTimeoutRef.current = undefined;
    }
  }, [isTracking, lineWidth, onLowEngagement, onMetricsUpdate]);

  useEffect(() => {
    if (!isTracking) {
      return undefined;
    }

    metricsIntervalRef.current = setInterval(updateMetrics, METRICS_SAMPLE_INTERVAL_MS);
    return () => {
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current);
        metricsIntervalRef.current = undefined;
      }
    };
  }, [isTracking, updateMetrics]);

  const calibrate = useCallback(
    async (
      method: 'explicit' | 'smooth-pursuit' | 'implicit',
      collectedPoints?: CalibrationPoint[]
    ) => {
      const points =
        collectedPoints && collectedPoints.length > 0
          ? collectedPoints
          : CalibrationUtils.generateGridPoints(9);
      const result = await EyeService.calibrate(method, points);
      setCalibration(result);
      return result;
    },
    []
  );

  const recordScroll = useCallback(() => {
    lastScrollYRef.current = Date.now() - startTimeRef.current;
  }, []);

  useEffect(() => {
    return () => {
      if (lowEngagementTimeoutRef.current) {
        clearTimeout(lowEngagementTimeoutRef.current);
      }
      AutoScrollController.disable();
      EyeService.stopTracking();
    };
  }, []);

  return {
    gazePoints,
    metrics,
    isTracking,
    calibration,
    predictedGaze,
    startTracking,
    stopTracking,
    calibrate,
    recordScroll,
  };
};
