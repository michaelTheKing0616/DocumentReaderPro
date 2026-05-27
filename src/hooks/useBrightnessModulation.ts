import { useState, useEffect, useCallback } from 'react';
import { EyeMetrics } from '../types';
import BrightnessService from '../services/brightness/BrightnessService';
import BrightnessFatigueService, { FatigueAssessment } from '../services/brightness/BrightnessFatigueService';

export const useBrightnessModulation = (enabled: boolean) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentBrightness, setCurrentBrightness] = useState(0.5);
  const [fatigueAssessment, setFatigueAssessment] = useState<FatigueAssessment | null>(null);

  useEffect(() => {
    const init = async () => {
      await BrightnessService.initialize();
      setIsInitialized(true);
    };
    init();

    return () => {
      BrightnessService.cleanup();
    };
  }, []);

  const adjustBrightness = useCallback(
    async (eyeMetrics?: EyeMetrics) => {
      if (!enabled || !isInitialized) return;
      await BrightnessService.adjustBrightness(eyeMetrics);
      const settings = BrightnessService.getSettings();
      setCurrentBrightness(settings.baseBrightness);
      setFatigueAssessment(BrightnessFatigueService.getLastAssessment());
    },
    [enabled, isInitialized]
  );

  const recordPageComplete = useCallback((pageDurationMs: number) => {
    BrightnessService.recordPageComplete(pageDurationMs);
  }, []);

  const setAutoAdjust = useCallback((autoEnabled: boolean) => {
    BrightnessService.setAutoAdjust(autoEnabled);
  }, []);

  const setBaseBrightness = useCallback(async (brightness: number) => {
    await BrightnessService.setBaseBrightness(brightness);
    setCurrentBrightness(brightness);
  }, []);

  const getSettings = useCallback(() => {
    return BrightnessService.getSettings();
  }, []);

  return {
    isInitialized,
    currentBrightness,
    fatigueAssessment,
    adjustBrightness,
    recordPageComplete,
    setAutoAdjust,
    setBaseBrightness,
    getSettings,
  };
};
