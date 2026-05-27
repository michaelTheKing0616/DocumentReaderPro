import { Platform } from 'react-native';
import { GazePoint, HardwareType } from '../../types';
import { isDevLabEnabled } from '../../utils/mockGate';
import { getScreenDimensions } from '../../utils/dimensions';
import { logger } from '../logger/Logger';
import { GazeCallback, GazeSource, GazeSourceConfig } from '../eye/GazeSource';
import WebGazerSource from '../eye/WebGazerSource';
import PupilService from './PupilService';
import TobiiService from './TobiiService';
import EyeLinkService from './EyeLinkService';
import SMIService from './SMIService';
import GazepointService from './GazepointService';
import GazeSenseService from './GazeSenseService';
import { createMockGazeStream } from './mockGazeStream';

interface HardwareService {
  setGazeCallback(callback: (point: GazePoint) => void): void;
  isDeviceConnected(): boolean;
}

class HardwareBridgeSource implements GazeSource {
  readonly id: string;
  isActive = false;

  private callback: GazeCallback | null = null;
  private readonly service: HardwareService;
  private readonly hardwareType: HardwareType;

  constructor(hardwareType: HardwareType, service: HardwareService) {
    this.id = `hardware-${hardwareType}`;
    this.hardwareType = hardwareType;
    this.service = service;
  }

  async start(onGazePoint: GazeCallback, _config?: GazeSourceConfig): Promise<boolean> {
    if (this.isActive) {
      return true;
    }

    if (!this.service.isDeviceConnected()) {
      logger.warn('HardwareBridgeSource device not connected', { type: this.hardwareType });
      return false;
    }

    this.callback = onGazePoint;
    this.service.setGazeCallback((point) => {
      this.callback?.(point);
    });

    this.isActive = true;
    logger.info('HardwareBridgeSource streaming', { type: this.hardwareType });
    return true;
  }

  stop(): void {
    this.isActive = false;
    this.callback = null;
  }
}

class NullGazeSource implements GazeSource {
  readonly id = 'null';
  isActive = false;

  async start(): Promise<boolean> {
    logger.warn('NullGazeSource: no gaze hardware configured');
    return false;
  }

  stop(): void {
    this.isActive = false;
  }
}

class DevLabGazeSource implements GazeSource {
  readonly id = 'dev-lab-mock';
  isActive = false;

  private callback: GazeCallback | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;

  async start(onGazePoint: GazeCallback, config?: GazeSourceConfig): Promise<boolean> {
    if (!isDevLabEnabled()) {
      return false;
    }

    const sampleRateHz = config?.sampleRateHz ?? 60;
    this.callback = onGazePoint;
    this.interval = createMockGazeStream(
      (point) => this.callback?.(point),
      sampleRateHz,
      () => this.isActive
    );

    if (!this.interval) {
      return false;
    }

    this.isActive = true;
    logger.debug('DevLabGazeSource started');
    return true;
  }

  stop(): void {
    this.isActive = false;
    this.callback = null;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

export class HardwareGazeAdapter {
  private activeSource: GazeSource | null = null;
  private preferredHardware: HardwareType = 'none';

  setPreferredHardware(type: HardwareType): void {
    this.preferredHardware = type;
  }

  getPreferredHardware(): HardwareType {
    return this.preferredHardware;
  }

  resolveSource(hardwareType: HardwareType = this.preferredHardware): GazeSource {
    if (hardwareType === 'webgazer') {
      return WebGazerSource;
    }

    if (hardwareType === 'none') {
      if (Platform.OS === 'web') {
        return WebGazerSource;
      }
      if (isDevLabEnabled()) {
        return new DevLabGazeSource();
      }
      return new NullGazeSource();
    }

    const service = this.getHardwareService(hardwareType);
    if (service) {
      return new HardwareBridgeSource(hardwareType, service);
    }

    return new NullGazeSource();
  }

  async start(
    onGazePoint: GazeCallback,
    hardwareType?: HardwareType,
    config?: GazeSourceConfig
  ): Promise<boolean> {
    await this.stop();

    const source = this.resolveSource(hardwareType ?? this.preferredHardware);
    const started = await source.start(onGazePoint, config);

    if (started) {
      this.activeSource = source;
      logger.info('HardwareGazeAdapter stream started', { sourceId: source.id });
    }

    return started;
  }

  stop(): void {
    if (this.activeSource) {
      this.activeSource.stop();
      this.activeSource = null;
    }
  }

  isStreaming(): boolean {
    return this.activeSource?.isActive ?? false;
  }

  getActiveSourceId(): string | null {
    return this.activeSource?.id ?? null;
  }

  private getHardwareService(type: HardwareType): HardwareService | null {
    switch (type) {
      case 'pupil-labs':
        return PupilService;
      case 'tobii':
        return TobiiService;
      case 'eyelink':
        return EyeLinkService;
      case 'smi':
        return SMIService;
      case 'gazepoint':
        return GazepointService;
      case 'gazesense':
        return GazeSenseService;
      default:
        return null;
    }
  }
}

export default new HardwareGazeAdapter();
