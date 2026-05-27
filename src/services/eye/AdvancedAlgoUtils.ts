import { GazePoint, Fixation, Saccade } from '../../types';

export class AdvancedAlgoUtils {
  // I-DT Algorithm: Dispersion-Threshold Identification
  static iDT(
    gazePoints: GazePoint[],
    dispersionThreshold: number = 1, // degrees
    durationThreshold: number = 100 // milliseconds
  ): Fixation[] {
    const fixations: Fixation[] = [];
    let windowStart = 0;

    for (let i = 1; i < gazePoints.length; i++) {
      const window = gazePoints.slice(windowStart, i + 1);
      const dispersion = this.calculateDispersion(window);

      // Convert pixels to degrees (approximate: 1° ≈ 60 pixels)
      const dispersionDegrees = dispersion / 60;

      if (dispersionDegrees > dispersionThreshold) {
        const duration = window[window.length - 1].timestamp - window[0].timestamp;
        if (duration >= durationThreshold && window.length > 1) {
          const center = this.calculateCenter(window);
          fixations.push({
            x: center.x,
            y: center.y,
            duration,
            startTime: window[0].timestamp,
            endTime: window[window.length - 1].timestamp,
          });
        }
        windowStart = i;
      }
    }

    return fixations;
  }

  // I-VT Algorithm: Velocity-Threshold Identification
  static iVT(
    gazePoints: GazePoint[],
    velocityThreshold: number = 30 // degrees per second
  ): Saccade[] {
    const saccades: Saccade[] = [];

    for (let i = 1; i < gazePoints.length; i++) {
      const prev = gazePoints[i - 1];
      const curr = gazePoints[i];
      const dt = (curr.timestamp - prev.timestamp) / 1000;

      if (dt === 0) continue;

      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const distanceDegrees = distance / 60;
      const velocity = distanceDegrees / dt;

      if (velocity > velocityThreshold) {
        saccades.push({
          startX: prev.x,
          startY: prev.y,
          endX: curr.x,
          endY: curr.y,
          duration: curr.timestamp - prev.timestamp,
          velocity,
          timestamp: curr.timestamp,
        });
      }
    }

    return saccades;
  }

  // Calculate dispersion of gaze points
  private static calculateDispersion(points: GazePoint[]): number {
    if (points.length < 2) return 0;

    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    return Math.max(maxX - minX, maxY - minY);
  }

  // Calculate center of gaze points
  private static calculateCenter(points: GazePoint[]): { x: number; y: number } {
    const sumX = points.reduce((sum, p) => sum + p.x, 0);
    const sumY = points.reduce((sum, p) => sum + p.y, 0);
    return {
      x: sumX / points.length,
      y: sumY / points.length,
    };
  }
}

