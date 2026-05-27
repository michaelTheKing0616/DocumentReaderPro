import { GazePoint } from '../../types';
import { getScreenDimensions } from '../../utils/dimensions';
import { logger } from '../logger/Logger';

export interface AutoScrollConfig {
  /** Normalized Y band (0–1) from top that triggers upward scroll. */
  topZoneRatio: number;
  /** Normalized Y band (0–1) from bottom that triggers downward scroll. */
  bottomZoneRatio: number;
  /** Pixels scrolled per tick while gaze remains in a zone. */
  scrollStepPx: number;
  /** Minimum ms between scroll ticks. */
  throttleMs: number;
}

export interface ScrollHandler {
  (deltaY: number): void;
}

const DEFAULT_CONFIG: AutoScrollConfig = {
  topZoneRatio: 0.15,
  bottomZoneRatio: 0.15,
  scrollStepPx: 48,
  throttleMs: 120,
};

export class AutoScrollController {
  private config: AutoScrollConfig;
  private enabled = false;
  private scrollHandler: ScrollHandler | null = null;
  private lastScrollAt = 0;
  private lastDirection: -1 | 0 | 1 = 0;

  constructor(config: Partial<AutoScrollConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  configure(config: Partial<AutoScrollConfig>): void {
    this.config = { ...this.config, ...config };
  }

  enable(onScroll: ScrollHandler): void {
    this.enabled = true;
    this.scrollHandler = onScroll;
    logger.debug('AutoScrollController enabled');
  }

  disable(): void {
    this.enabled = false;
    this.scrollHandler = null;
    this.lastDirection = 0;
  }

  /** Feed gaze samples; scroll when Y enters top/bottom bands. */
  handleGazePoint(point: GazePoint): void {
    if (!this.enabled || !this.scrollHandler) {
      return;
    }

    const { height } = getScreenDimensions();
    if (height <= 0) {
      return;
    }

    const normalizedY = point.y / height;
    const now = Date.now();
    let direction: -1 | 0 | 1 = 0;

    if (normalizedY <= this.config.topZoneRatio) {
      direction = -1;
    } else if (normalizedY >= 1 - this.config.bottomZoneRatio) {
      direction = 1;
    }

    if (direction === 0) {
      this.lastDirection = 0;
      return;
    }

    if (
      direction === this.lastDirection &&
      now - this.lastScrollAt < this.config.throttleMs
    ) {
      return;
    }

    this.lastDirection = direction;
    this.lastScrollAt = now;
    this.scrollHandler(direction * this.config.scrollStepPx);
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

export default new AutoScrollController();
