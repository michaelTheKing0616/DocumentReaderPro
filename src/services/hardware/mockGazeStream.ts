import { GazePoint } from '../../types';
import { getScreenDimensions } from '../../utils/dimensions';
import { isDevLabEnabled } from '../../utils/mockGate';

/** Random gaze simulator — only when EXPO_PUBLIC_DEV_LAB=true. */
export function createMockGazeStream(
  callback: (point: GazePoint) => void,
  hz: number,
  isActive: () => boolean
): ReturnType<typeof setInterval> | null {
  if (!isDevLabEnabled()) {
    return null;
  }

  const { width, height } = getScreenDimensions();
  let x = width / 2;
  let y = height / 2;

  return setInterval(() => {
    if (!isActive()) {
      return;
    }
    x = Math.max(0, Math.min(width, x + (Math.random() - 0.5) * 20));
    y = Math.max(0, Math.min(height, y + (Math.random() - 0.5) * 12));
    callback({ x, y, timestamp: Date.now() });
  }, 1000 / hz);
}
