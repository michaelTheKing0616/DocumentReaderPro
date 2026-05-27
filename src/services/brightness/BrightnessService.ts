import * as Brightness from 'expo-brightness';
import * as Sensors from 'expo-sensors';
import { BrightnessSettings, EyeMetrics } from '../../types';
import { logger } from '../logger/Logger';
import BrightnessFatigueService, { FatigueAssessment } from './BrightnessFatigueService';

const FATIGUE_THRESHOLDS = {
  regressionCountHigh: 10,
  regressionRateHigh: 0.25,
  blinkRateHighPerMin: 20,
  fixationCountHigh: 50,
  engagementLow: 60,
  dimFactorHighFatigue: 0.8,
  dimFactorModerateFatigue: 0.9,
} as const;

class BrightnessService {
  private settings: BrightnessSettings = {
    autoAdjust: false,
    baseBrightness: 0.5,
    ambientLight: 0,
    timeOfDay: 'afternoon',
    eyeSensitivity: 0.5,
  };
  private ambientLightSubscription: { remove: () => void } | null = null;
  private currentBrightness = 0.5;
  private lastFatigueLevel: 'none' | 'moderate' | 'high' = 'none';
  private lastFatigueAssessment: FatigueAssessment | null = null;

  async initialize(): Promise<void> {
    try {
      await Brightness.requestPermissionsAsync();
      this.currentBrightness = await Brightness.getBrightnessAsync();
      this.settings.baseBrightness = this.currentBrightness;
      BrightnessFatigueService.startSession();
      await this.startAmbientLightSensor();
      this.updateTimeOfDay();
    } catch (error) {
      logger.error('Brightness initialization error', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async startAmbientLightSensor(): Promise<void> {
    try {
      const { LightSensor } = Sensors;
      const isAvailable = await LightSensor.isAvailableAsync();

      if (isAvailable) {
        this.ambientLightSubscription = LightSensor.addListener(({ illuminance }) => {
          this.settings.ambientLight = illuminance;
          if (this.settings.autoAdjust) {
            void this.adjustBrightness();
          }
        });
        LightSensor.setUpdateInterval(1000);
      }
    } catch (error) {
      logger.error('Ambient light sensor error', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private updateTimeOfDay(): void {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) {
      this.settings.timeOfDay = 'morning';
    } else if (hour >= 12 && hour < 17) {
      this.settings.timeOfDay = 'afternoon';
    } else if (hour >= 17 && hour < 21) {
      this.settings.timeOfDay = 'evening';
    } else {
      this.settings.timeOfDay = 'night';
    }
  }

  /** Estimate blink rate from gaze gaps or explicit blinkCount on EyeMetrics. */
  private estimateBlinkRate(eyeMetrics: EyeMetrics): number {
    if (eyeMetrics.blinkCount != null && eyeMetrics.timeOnPage > 0) {
      const minutes = eyeMetrics.timeOnPage / 60000;
      return minutes > 0 ? eyeMetrics.blinkCount / minutes : 0;
    }
    // Infer from micro-saccades with very short duration as blink proxy
    const microSaccades = eyeMetrics.saccades.filter((s) => s.duration < 80);
    const minutes = eyeMetrics.timeOnPage / 60000;
    return minutes > 0 ? microSaccades.length / minutes : 0;
  }

  private computeRegressionRate(eyeMetrics: EyeMetrics): number {
    if (eyeMetrics.saccades.length === 0) {
      return eyeMetrics.regressions.length > 0 ? 1 : 0;
    }
    return eyeMetrics.regressions.length / eyeMetrics.saccades.length;
  }

  predictEyeSensitivity(eyeMetrics: EyeMetrics): number {
    const regressionCount = eyeMetrics.regressions.length;
    const regressionRate = this.computeRegressionRate(eyeMetrics);
    const blinkRate = this.estimateBlinkRate(eyeMetrics);
    const fixationCount = eyeMetrics.fixations.length;
    const lowEngagement = eyeMetrics.engagement < FATIGUE_THRESHOLDS.engagementLow;

    let sensitivity = 0.5;

    if (regressionCount > FATIGUE_THRESHOLDS.regressionCountHigh) {
      sensitivity += 0.15;
    }
    if (regressionRate > FATIGUE_THRESHOLDS.regressionRateHigh) {
      sensitivity += 0.15;
    }
    if (blinkRate > FATIGUE_THRESHOLDS.blinkRateHighPerMin) {
      sensitivity += 0.15;
    }
    if (fixationCount > FATIGUE_THRESHOLDS.fixationCountHigh) {
      sensitivity += 0.1;
    }
    if (lowEngagement) {
      sensitivity += 0.15;
    }

    const clamped = Math.min(1, Math.max(0, sensitivity));

    if (clamped >= 0.75) {
      this.lastFatigueLevel = 'high';
    } else if (clamped >= 0.6) {
      this.lastFatigueLevel = 'moderate';
    } else {
      this.lastFatigueLevel = 'none';
    }

    return clamped;
  }

  getLastFatigueLevel(): 'none' | 'moderate' | 'high' {
    return this.lastFatigueLevel;
  }

  getLastFatigueAssessment(): FatigueAssessment | null {
    return this.lastFatigueAssessment;
  }

  recordPageComplete(pageDurationMs: number): void {
    BrightnessFatigueService.recordPageComplete(pageDurationMs);
  }

  async adjustBrightness(eyeMetrics?: EyeMetrics): Promise<void> {
    if (!this.settings.autoAdjust) {
      return;
    }

    let targetBrightness = this.settings.baseBrightness;

    if (this.settings.ambientLight > 0) {
      const ambientFactor = Math.min(1, this.settings.ambientLight / 1000);
      targetBrightness = 0.3 + ambientFactor * 0.4;
    }

    if (this.settings.timeOfDay === 'night') {
      targetBrightness *= 0.6;
    } else if (this.settings.timeOfDay === 'evening') {
      targetBrightness *= 0.8;
    }

    if (eyeMetrics) {
      const sensitivity = this.predictEyeSensitivity(eyeMetrics);
      this.settings.eyeSensitivity = sensitivity;

      const fatigue = BrightnessFatigueService.assessFromMetrics(eyeMetrics);
      this.lastFatigueAssessment = fatigue;
      this.lastFatigueLevel = fatigue.level;

      if (sensitivity >= 0.75) {
        targetBrightness *= FATIGUE_THRESHOLDS.dimFactorHighFatigue;
      } else if (sensitivity >= 0.6) {
        targetBrightness *= FATIGUE_THRESHOLDS.dimFactorModerateFatigue;
      }

      targetBrightness *= fatigue.dimFactor;
    }

    targetBrightness = Math.max(0.1, Math.min(1, targetBrightness));

    try {
      await Brightness.setBrightnessAsync(targetBrightness);
      this.currentBrightness = targetBrightness;
      logger.debug('Brightness adjusted', {
        target: targetBrightness,
        fatigue: this.lastFatigueLevel,
      });
    } catch (error) {
      logger.error('Brightness adjustment error', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  setAutoAdjust(enabled: boolean): void {
    this.settings.autoAdjust = enabled;
    if (!enabled) {
      void Brightness.setBrightnessAsync(this.settings.baseBrightness);
    }
  }

  async setBaseBrightness(brightness: number): Promise<void> {
    this.settings.baseBrightness = Math.max(0, Math.min(1, brightness));
    if (!this.settings.autoAdjust) {
      await Brightness.setBrightnessAsync(this.settings.baseBrightness);
    }
  }

  getSettings(): BrightnessSettings {
    return { ...this.settings };
  }

  getCurrentBrightness(): number {
    return this.currentBrightness;
  }

  cleanup(): void {
    BrightnessFatigueService.endSession();
    if (this.ambientLightSubscription) {
      this.ambientLightSubscription.remove();
      this.ambientLightSubscription = null;
    }
  }
}

export default new BrightnessService();
