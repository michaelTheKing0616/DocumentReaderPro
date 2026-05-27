import { GazePoint, HardwareConfig } from '../../types';
import { logger } from '../logger/Logger';
import { startHardwareGazeStream } from './gazeStreamHelper';

class EyeLinkService {
  private config: HardwareConfig | null = null;
  private isConnected = false;
  private gazeCallback?: (point: GazePoint) => void;
  private interval: ReturnType<typeof setInterval> | null = null;

  async initialize(): Promise<boolean> {
    return true;
  }

  async connect(): Promise<boolean> {
    try {
      if (!(await this.initialize())) {
        return false;
      }
      this.config = { type: 'eyelink', connected: true };
      this.isConnected = true;
      this.startGazeStream();
      return true;
    } catch (error) {
      logger.error('EyeLink connection error', {
        message: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  private startGazeStream() {
    if (!this.isConnected || !this.gazeCallback) {
      return;
    }
    if (this.interval) {
      clearInterval(this.interval);
    }
    this.interval = startHardwareGazeStream('EyeLink', this.gazeCallback, 120, () => this.isConnected);
  }

  setGazeCallback(callback: (point: GazePoint) => void) {
    this.gazeCallback = callback;
    if (this.isConnected) {
      this.startGazeStream();
    }
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.config = null;
    this.gazeCallback = undefined;
  }

  getConfig(): HardwareConfig | null {
    return this.config;
  }

  isDeviceConnected(): boolean {
    return this.isConnected;
  }
}

export default new EyeLinkService();
