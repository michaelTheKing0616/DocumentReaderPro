import { GazePoint, HardwareConfig } from '../../types';
import { logger } from '../logger/Logger';
import { startHardwareGazeStream } from './gazeStreamHelper';

function createHardwareService(type: HardwareConfig['type'], hz: number) {
  let config: HardwareConfig | null = null;
  let isConnected = false;
  let gazeCallback: ((point: GazePoint) => void) | undefined;
  let interval: ReturnType<typeof setInterval> | null = null;

  const startGazeStream = () => {
    if (!isConnected || !gazeCallback) {
      return;
    }
    if (interval) {
      clearInterval(interval);
    }
    interval = startHardwareGazeStream(String(type), gazeCallback, hz, () => isConnected);
  };

  return {
    async connect(): Promise<boolean> {
      try {
        config = { type, connected: true };
        isConnected = true;
        startGazeStream();
        return true;
      } catch (error) {
        logger.error(`${type} connection error`, {
          message: error instanceof Error ? error.message : String(error),
        });
        return false;
      }
    },
    setGazeCallback(callback: (point: GazePoint) => void) {
      gazeCallback = callback;
      if (isConnected) {
        startGazeStream();
      }
    },
    async disconnect(): Promise<void> {
      isConnected = false;
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
      config = null;
      gazeCallback = undefined;
    },
    getConfig(): HardwareConfig | null {
      return config;
    },
    isDeviceConnected(): boolean {
      return isConnected;
    },
  };
}

export default {
  smi: createHardwareService('smi', 60),
  beam: createHardwareService('webgazer', 30),
  gazepoint: createHardwareService('gazepoint', 60),
  eyelink: createHardwareService('eyelink', 120),
  gazesense: createHardwareService('gazesense', 30),
};
