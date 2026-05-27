import { Platform } from 'react-native';
import { GazePoint } from '../../types';
import { isDevLabEnabled } from '../../utils/mockGate';
import { getScreenDimensions } from '../../utils/dimensions';
import { logger } from '../logger/Logger';
import { GazeCallback, GazeSource, GazeSourceConfig } from './GazeSource';
import { createMockGazeStream } from '../hardware/mockGazeStream';

const DEFAULT_SAMPLE_RATE_HZ = 30;
const DEV_LAB_SAMPLE_RATE_HZ = 30;

type WebGazerModule = {
  setGazeListener: (
    callback: (data: { x: number; y: number } | null, elapsedTime?: number) => void
  ) => void;
  begin: () => Promise<void>;
  end: () => void;
  showVideoPreview: (show: boolean) => void;
  showPredictionPoints: (show: boolean) => void;
  pause: () => void;
  resume: () => void;
  clearGazeListener?: () => void;
};

declare global {
  interface Window {
    webgazer?: WebGazerModule;
  }
}

export class WebGazerSource implements GazeSource {
  readonly id = 'webgazer';
  isActive = false;

  private callback: GazeCallback | null = null;
  private devLabInterval: ReturnType<typeof setInterval> | null = null;
  private webgazerModule: WebGazerModule | null = null;
  private lastRawGaze: GazePoint | null = null;

  async start(onGazePoint: GazeCallback, config?: GazeSourceConfig): Promise<boolean> {
    if (this.isActive) {
      return true;
    }

    this.callback = onGazePoint;

    if (Platform.OS !== 'web') {
      logger.warn('WebGazerSource unavailable off web platform', { platform: Platform.OS });
      return false;
    }

    if (isDevLabEnabled()) {
      return this.startDevLabStream(config?.sampleRateHz ?? DEV_LAB_SAMPLE_RATE_HZ);
    }

    return this.startWebGazerStream();
  }

  stop(): void {
    this.isActive = false;
    this.callback = null;
    this.lastRawGaze = null;

    if (this.devLabInterval) {
      clearInterval(this.devLabInterval);
      this.devLabInterval = null;
    }

    if (this.webgazerModule) {
      try {
        this.webgazerModule.setGazeListener(() => undefined);
        this.webgazerModule.showVideoPreview(false);
        this.webgazerModule.end();
      } catch (error) {
        logger.warn('WebGazer teardown error', { error: String(error) });
      }
      this.webgazerModule = null;
    }
  }

  async enableCameraPreview(show: boolean): Promise<boolean> {
    if (Platform.OS !== 'web') {
      return false;
    }

    const webgazer = this.webgazerModule ?? (await this.loadWebGazer());
    if (!webgazer) {
      return false;
    }

    this.webgazerModule = webgazer;
    webgazer.showVideoPreview(show);
    return true;
  }

  getLastRawGaze(): GazePoint | null {
    return this.lastRawGaze;
  }

  private startDevLabStream(sampleRateHz: number): boolean {
    this.devLabInterval = createMockGazeStream(
      (point) => {
        this.lastRawGaze = point;
        this.callback?.(point);
      },
      sampleRateHz,
      () => this.isActive
    );

    if (!this.devLabInterval) {
      return false;
    }

    this.isActive = true;
    logger.debug('WebGazerSource dev-lab stream started', { sampleRateHz });
    return true;
  }

  private async startWebGazerStream(): Promise<boolean> {
    try {
      const webgazer = await this.loadWebGazer();
      if (!webgazer) {
        logger.error('WebGazer module failed to load');
        return false;
      }

      this.webgazerModule = webgazer;
      webgazer.showVideoPreview(false);
      webgazer.showPredictionPoints(false);

      webgazer.setGazeListener((data) => {
        if (!data || !this.callback) {
          return;
        }

        const point: GazePoint = {
          x: data.x,
          y: data.y,
          timestamp: Date.now(),
        };
        this.lastRawGaze = point;
        this.callback(point);
      });

      await webgazer.begin();
      this.isActive = true;
      logger.info('WebGazerSource started', { sampleRateHz: DEFAULT_SAMPLE_RATE_HZ });
      return true;
    } catch (error) {
      logger.error('WebGazerSource start failed', { error: String(error) });
      return false;
    }
  }

  private async loadWebGazer(): Promise<WebGazerModule | null> {
    if (typeof window !== 'undefined' && window.webgazer) {
      return window.webgazer;
    }

    try {
      const module = await import('webgazer');
      const webgazer = (module.default ?? module) as WebGazerModule;
      if (typeof window !== 'undefined') {
        window.webgazer = webgazer;
      }
      return webgazer;
    } catch (error) {
      logger.error('WebGazer import failed', { error: String(error) });
      return null;
    }
  }
}

export default new WebGazerSource();
