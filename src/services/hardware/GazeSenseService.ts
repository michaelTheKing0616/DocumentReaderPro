import { GazePoint, HardwareConfig } from '../../types';
import { logger } from '../logger/Logger';

class GazeSenseService {
  private config: HardwareConfig | null = null;
  private isConnected: boolean = false;
  private gazeCallback?: (point: GazePoint) => void;
  private ws: WebSocket | null = null;

  async connect(endpoint: string = 'ws://localhost:8080'): Promise<boolean> {
    try {
      // GazeSense REST/WebSocket API
      this.ws = new WebSocket(endpoint);
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.gaze && this.gazeCallback) {
            const gazePoint: GazePoint = {
              x: data.gaze.x,
              y: data.gaze.y,
              timestamp: Date.now(),
            };
            this.gazeCallback(gazePoint);
          }
        } catch (error) {
          logger.warn('GazeSense parse error', {
            message: error instanceof Error ? error.message : String(error),
          });
        }
      };

      this.ws.onopen = () => {
        this.config = {
          type: 'gazesense',
          connected: true,
          address: endpoint,
        };
        this.isConnected = true;
      };

      this.ws.onerror = (error) => {
        logger.error('GazeSense WebSocket error');
        this.isConnected = false;
      };

      return true;
    } catch (error) {
      logger.error('GazeSense connection error', {
        message: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  setGazeCallback(callback: (point: GazePoint) => void) {
    this.gazeCallback = callback;
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
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

export default new GazeSenseService();

