import { GazePoint, HardwareConfig } from '../../types';
import { getScreenDimensions } from '../../utils/dimensions';
import { isDevLabEnabled } from '../../utils/mockGate';
import { createMockGazeStream } from './mockGazeStream';
import { logger } from '../logger/Logger';

const PUPIL_DEFAULT_ZMQ_PORT = 50020;
const PUPIL_STATUS_HTTP_PORT = 8080;
const PUPIL_GAZE_TOPIC = 'gaze';
const PUPIL_SAMPLE_RATE_HZ = 120;
const MDNS_SERVICE_TYPE = '_pupil-remote._tcp.local.';

interface PupilGazePayload {
  norm_pos?: [number, number];
  timestamp?: number;
}

interface ZeroMqSubscriber {
  connect(address: string): void;
  subscribe(topic: string): void;
  onMessage(handler: (topic: string, payload: Buffer | string) => void): void;
  close(): void;
}

interface ZeroconfBrowser {
  scan(type: string): Promise<Array<{ name: string; host: string; port: number }>>;
  stop(): void;
}

class PupilService {
  private config: HardwareConfig | null = null;
  private isConnected = false;
  private gazeCallback?: (point: GazePoint) => void;
  private mockInterval: ReturnType<typeof setInterval> | null = null;
  private zmqSubscriber: ZeroMqSubscriber | null = null;
  private zeroconfBrowser: ZeroconfBrowser | null = null;

  async discoverDevices(): Promise<string[]> {
    if (isDevLabEnabled()) {
      logger.debug('PupilService dev-lab mDNS discovery');
      return ['neon.local', '192.168.1.100'];
    }

    try {
      this.zeroconfBrowser = await this.createZeroconfBrowser();
      const services = await this.zeroconfBrowser.scan(MDNS_SERVICE_TYPE);
      const addresses = services.map((service) => service.host);
      logger.info('PupilService mDNS discovery complete', { count: addresses.length });
      return addresses;
    } catch (error) {
      logger.error('Pupil discovery error', { error: String(error) });
      return [];
    } finally {
      this.zeroconfBrowser?.stop();
      this.zeroconfBrowser = null;
    }
  }

  async connect(
    address: string,
    port: number = PUPIL_DEFAULT_ZMQ_PORT
  ): Promise<boolean> {
    try {
      if (!isDevLabEnabled()) {
        const statusUrl = `http://${address}:${PUPIL_STATUS_HTTP_PORT}/api/status`;
        const response = await fetch(statusUrl);
        if (!response.ok) {
          throw new Error(`Pupil device unavailable at ${address}`);
        }
        await response.json();
      }

      this.config = {
        type: 'pupil-labs',
        connected: true,
        address,
        port,
      };
      this.isConnected = true;

      if (isDevLabEnabled()) {
        this.startDevLabGazeStream();
      } else {
        await this.startZeroMqGazeStream(address, port);
      }

      logger.info('PupilService connected', { address, port });
      return true;
    } catch (error) {
      logger.error('Pupil connection error', { error: String(error) });
      return false;
    }
  }

  setGazeCallback(callback: (point: GazePoint) => void): void {
    this.gazeCallback = callback;
    if (this.isConnected) {
      if (isDevLabEnabled()) {
        this.startDevLabGazeStream();
      }
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

    if (this.zmqSubscriber) {
      this.zmqSubscriber.close();
      this.zmqSubscriber = null;
    }
  }

  getConfig(): HardwareConfig | null {
    return this.config;
  }

  isDeviceConnected(): boolean {
    return this.isConnected;
  }

  private async startZeroMqGazeStream(address: string, port: number): Promise<void> {
    try {
      this.zmqSubscriber = await this.createZeroMqSubscriber();
      this.zmqSubscriber.connect(`tcp://${address}:${port}`);
      this.zmqSubscriber.subscribe(PUPIL_GAZE_TOPIC);
      this.zmqSubscriber.onMessage((_topic, payload) => {
        const point = this.parsePupilGazeMessage(payload);
        if (point && this.gazeCallback) {
          this.gazeCallback(point);
        }
      });
      logger.info('PupilService ZeroMQ gaze stream subscribed', { address, port });
    } catch (error) {
      logger.error('Pupil ZeroMQ stream error', { error: String(error) });
      throw error;
    }
  }

  private startDevLabGazeStream(): void {
    if (!this.isConnected || !this.gazeCallback || this.mockInterval) {
      return;
    }

    this.mockInterval = createMockGazeStream(
      (point) => this.gazeCallback?.(point),
      PUPIL_SAMPLE_RATE_HZ,
      () => this.isConnected
    );
  }

  private parsePupilGazeMessage(payload: Buffer | string): GazePoint | null {
    try {
      const raw = typeof payload === 'string' ? payload : payload.toString('utf8');
      const message = JSON.parse(raw) as PupilGazePayload;
      if (!message.norm_pos || message.norm_pos.length < 2) {
        return null;
      }

      const { width, height } = getScreenDimensions();
      return {
        x: message.norm_pos[0] * width,
        y: message.norm_pos[1] * height,
        timestamp: message.timestamp ?? Date.now(),
      };
    } catch (error) {
      logger.warn('Pupil gaze parse error', { error: String(error) });
      return null;
    }
  }

  private async createZeroMqSubscriber(): Promise<ZeroMqSubscriber> {
    // Optional native dependency — not bundled on web (see src/shims/react-native-zeromq.web.ts).
    // eslint-disable-next-line import/no-unresolved
    const module = await import('react-native-zeromq');
    const ZeroMq = module.default ?? module;
    return new ZeroMq.Subscriber() as ZeroMqSubscriber;
  }

  private async createZeroconfBrowser(): Promise<ZeroconfBrowser> {
    try {
      // Optional native dependency — not bundled in default APK builds.
      // eslint-disable-next-line import/no-unresolved
      const module = await import('react-native-zeroconf');
      const Zeroconf = module.default ?? module;
      return new Zeroconf() as ZeroconfBrowser;
    } catch {
      throw new Error('react-native-zeroconf is not installed');
    }
  }
}

export default new PupilService();
