import { GazePoint } from '../../types';
import { isMockDataEnabled } from '../../utils/mockGate';
import { logger } from '../logger/Logger';
import { createMockGazeStream } from './mockGazeStream';

/**
 * Starts a gaze stream for hardware SDK adapters.
 * Production builds without dev-lab never emit synthetic gaze data.
 */
export function startHardwareGazeStream(
  hardwareLabel: string,
  callback: (point: GazePoint) => void,
  hz: number,
  isConnected: () => boolean
): ReturnType<typeof setInterval> | null {
  if (!isMockDataEnabled()) {
    logger.warn(`${hardwareLabel}: native SDK not available — connect hardware or enable EXPO_PUBLIC_DEV_LAB`);
    return null;
  }
  return createMockGazeStream(callback, hz, isConnected);
}
