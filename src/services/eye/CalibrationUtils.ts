import {
  CalibrationPoint,
  CalibrationResult,
  CalibrationMethod,
} from '../../types';
import { getScreenDimensions } from '../../utils/dimensions';

export namespace CalibrationUtils {
  export interface AffineTransform {
    scaleX: number;
    scaleY: number;
    offsetX: number;
    offsetY: number;
  }

  export interface LinearRegressionResult {
    slope: number;
    intercept: number;
  }
}

export class CalibrationUtils {
  private static readonly MIN_ACCURACY = 0.7;
  private static readonly MIN_POINTS = 5;
  private static readonly GRID_MARGIN_RATIO = 0.1;
  private static readonly GRID_SPAN_RATIO = 0.8;

  static generateGridPoints(count = 9): CalibrationPoint[] {
    const { width, height } = getScreenDimensions();
    const points: CalibrationPoint[] = [];
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);

    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const normalizedX =
        cols === 1
          ? 0.5
          : (col / (cols - 1)) * this.GRID_SPAN_RATIO + this.GRID_MARGIN_RATIO;
      const normalizedY =
        rows === 1
          ? 0.5
          : (row / (rows - 1)) * this.GRID_SPAN_RATIO + this.GRID_MARGIN_RATIO;

      points.push({
        x: normalizedX * width,
        y: normalizedY * height,
      });
    }

    return points;
  }

  static calculateAccuracy(
    calibrationPoints: CalibrationPoint[],
    _method: CalibrationMethod
  ): number {
    if (calibrationPoints.length === 0) {
      return 0;
    }

    const { width, height } = getScreenDimensions();
    let totalError = 0;
    let validPoints = 0;

    for (const point of calibrationPoints) {
      if (point.gazeX === undefined || point.gazeY === undefined) {
        continue;
      }

      const error = Math.hypot(point.x - point.gazeX, point.y - point.gazeY);
      totalError += error;
      validPoints++;
    }

    if (validPoints === 0) {
      return 0;
    }

    const avgError = totalError / validPoints;
    const maxError = Math.hypot(width, height);
    return Math.max(0, 1 - avgError / maxError);
  }

  static linearRegression(
    calibrationPoints: CalibrationPoint[],
    axis: 'x' | 'y' = 'y'
  ): CalibrationUtils.LinearRegressionResult {
    const pairs = calibrationPoints.filter(
      (point) => point.gazeX !== undefined && point.gazeY !== undefined
    );

    if (pairs.length < 2) {
      return { slope: 1, intercept: 0 };
    }

    const n = pairs.length;
    let sumTarget = 0;
    let sumGaze = 0;
    let sumTargetGaze = 0;
    let sumTargetSquared = 0;

    for (const point of pairs) {
      const target = axis === 'x' ? point.x : point.y;
      const gaze = axis === 'x' ? point.gazeX! : point.gazeY!;
      sumTarget += target;
      sumGaze += gaze;
      sumTargetGaze += target * gaze;
      sumTargetSquared += target * target;
    }

    const denominator = n * sumTargetSquared - sumTarget * sumTarget;
    if (denominator === 0) {
      return { slope: 1, intercept: 0 };
    }

    const slope = (n * sumTargetGaze - sumTarget * sumGaze) / denominator;
    const intercept = (sumGaze - slope * sumTarget) / n;
    return { slope, intercept };
  }

  /** Least-squares affine mapping from raw gaze to screen coordinates. */
  static buildAffineTransform(
    calibrationPoints: CalibrationPoint[]
  ): CalibrationUtils.AffineTransform {
    const valid = calibrationPoints.filter(
      (point) => point.gazeX !== undefined && point.gazeY !== undefined
    );

    if (valid.length === 0) {
      return { scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0 };
    }

    const xRegression = this.linearRegression(valid, 'x');
    const yRegression = this.linearRegression(valid, 'y');

    return {
      scaleX: xRegression.slope,
      scaleY: yRegression.slope,
      offsetX: xRegression.intercept,
      offsetY: yRegression.intercept,
    };
  }

  static applyAffineTransform(
    point: { x: number; y: number },
    transform: CalibrationUtils.AffineTransform
  ): { x: number; y: number } {
    return {
      x: point.x * transform.scaleX + transform.offsetX,
      y: point.y * transform.scaleY + transform.offsetY,
    };
  }

  static mapGazeToScreen(
    gazeX: number,
    gazeY: number,
    transform: CalibrationUtils.AffineTransform
  ): { x: number; y: number } {
    return this.applyAffineTransform({ x: gazeX, y: gazeY }, transform);
  }

  static validateCalibration(result: CalibrationResult): boolean {
    if (!result.completed) {
      return false;
    }
    if (result.accuracy < this.MIN_ACCURACY) {
      return false;
    }
    if (result.points.length < this.MIN_POINTS) {
      return false;
    }
    return true;
  }
}
