import { GazePoint, HardwareConfig } from '../../types';
import { getScreenDimensions } from '../../utils/dimensions';
import { isDevLabEnabled, isMockDataEnabled } from '../../utils/mockGate';
import { createMockGazeStream } from './mockGazeStream';
import { logger } from '../logger/Logger';

const TOBII_SAMPLE_RATE_HZ = 60;

interface TobiiBridgeGazeEvent {
  x: number;
  y: number;
  timestamp: number;
  valid?: boolean;
}

interface TobiiElectronBridge {
  initialize(): Promise<boolean | { ok: boolean }>;
  connect(): Promise<boolean | { ok: boolean }>;
  disconnect(): Promise<void | { ok: boolean }>;
  calibrate(): Promise<boolean | { ok: boolean }>;
  getStatus?(): Promise<{ connected: boolean; initialized: boolean }>;
  isConnected?(): Promise<boolean>;
  onGaze(callback: (event: TobiiBridgeGazeEvent) => void): () => void;
}

declare global {
  interface Window {
    readAssistTobiiBridge?: TobiiElectronBridge;
  }
}

class TobiiService {
  private config: HardwareConfig | null = null;
  private isConnected = false;
  private gazeCallback?: (point: GazePoint) => void;
  private mockInterval: ReturnType<typeof setInterval> | null = null;
  private bridgeUnsubscribe: (() => void) | null = null;
  private electronBridge: TobiiElectronBridge | null = null;

  async initialize(): Promise<boolean> {
    if (isDevLabEnabled()) {
      return true;
    }

    try {
      this.electronBridge = this.resolveElectronBridge();
      if (!this.electronBridge) {
        logger.warn('Tobii Electron bridge unavailable');
        return false;
      }
      return this.coerceBridgeSuccess(await this.electronBridge.initialize());
    } catch (error) {
      logger.error('Tobii initialization error', { error: String(error) });
      return false;
    }
  }

  async connect(): Promise<boolean> {
    try {
      if (isDevLabEnabled()) {
        this.config = {
          type: 'tobii',
          connected: true,
          address: 'dev-lab',
          port: 0,
        };
        this.isConnected = true;
        this.startDevLabGazeStream();
        logger.info('TobiiService dev-lab connection established');
        return true;
      }

      if (!(await this.initialize()) || !this.electronBridge) {
        return false;
      }

      const connected = this.coerceBridgeSuccess(await this.electronBridge.connect());
      if (!connected) {
        return false;
      }

      this.config = {
        type: 'tobii',
        connected: true,
        address: 'electron-bridge',
        port: 0,
      };
      this.isConnected = true;
      this.startBridgeGazeStream();
      logger.info('TobiiService connected via Electron bridge');
      return true;
    } catch (error) {
      logger.error('Tobii connection error', { error: String(error) });
      return false;
    }
  }

  setGazeCallback(callback: (point: GazePoint) => void): void {
    this.gazeCallback = callback;
    if (this.isConnected) {
      if (isDevLabEnabled()) {
        this.startDevLabGazeStream();
      } else {
        this.startBridgeGazeStream();
      }
    }
  }

  async calibrate(): Promise<boolean> {
    try {
      if (isMockDataEnabled()) {
        return true;
      }
      if (!this.electronBridge) {
        return false;
      }
      return this.coerceBridgeSuccess(await this.electronBridge.calibrate());
    } catch (error) {
      logger.error('Tobii calibration error', { error: String(error) });
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.config = null;
    this.gazeCallback = undefined;

    if (this.mockInterval) {
      clearInterval(this.mockInterval);
      this.mockInterval = null;
    }

    if (this.bridgeUnsubscribe) {
      this.bridgeUnsubscribe();
      this.bridgeUnsubscribe = null;
    }

    if (this.electronBridge && !isMockDataEnabled()) {
      await this.electronBridge.disconnect();
    }
  }

  getConfig(): HardwareConfig | null {
    return this.config;
  }

  isDeviceConnected(): boolean {
    return this.isConnected;
  }

  private coerceBridgeSuccess(result: boolean | { ok?: boolean }): boolean {
    if (typeof result === 'boolean') {
      return result;
    }
    return result?.ok !== false;
  }

  private resolveElectronBridge(): TobiiElectronBridge | null {
    if (typeof window !== 'undefined' && window.readAssistTobiiBridge) {
      return window.readAssistTobiiBridge;
    }
    return null;
  }

  private startBridgeGazeStream(): void {
    if (!this.isConnected || !this.gazeCallback || !this.electronBridge) {
      return;
    }

    if (this.bridgeUnsubscribe) {
      this.bridgeUnsubscribe();
    }

    this.bridgeUnsubscribe = this.electronBridge.onGaze((event) => {
      if (!this.gazeCallback || event.valid === false) {
        return;
      }

      const { width, height } = getScreenDimensions();
      this.gazeCallback({
        x: Math.max(0, Math.min(width, event.x)),
        y: Math.max(0, Math.min(height, event.y)),
        timestamp: event.timestamp,
      });
    });
  }

  private startDevLabGazeStream(): void {
    if (!this.isConnected || !this.gazeCallback || this.mockInterval) {
      return;
    }

    this.mockInterval = createMockGazeStream(
      (point) => this.gazeCallback?.(point),
      TOBII_SAMPLE_RATE_HZ,
      () => this.isConnected
    );
  }
}

export default new TobiiService();
