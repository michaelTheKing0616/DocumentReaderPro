import { GazePoint } from '../../types';

export type GazeCallback = (point: GazePoint) => void;

export interface GazeSourceConfig {
  /** Target sample rate in Hz (best effort). */
  sampleRateHz?: number;
}

export interface GazeSource {
  readonly id: string;
  readonly isActive: boolean;

  /** Begin streaming gaze samples. Returns false when unavailable. */
  start(onGazePoint: GazeCallback, config?: GazeSourceConfig): Promise<boolean>;

  /** Stop streaming and release resources. */
  stop(): void;

  /** Optional camera preview (WebGazer on web). */
  enableCameraPreview?(show: boolean): Promise<boolean>;
}
