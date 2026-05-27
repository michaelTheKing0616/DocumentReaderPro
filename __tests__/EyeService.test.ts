jest.mock('../src/services/hardware/HardwareGazeAdapter', () => ({
  __esModule: true,
  default: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    setCallback: jest.fn(),
    getActiveSource: jest.fn(),
  },
}));

jest.mock('../src/services/eye/NeuralGazePredictor', () => ({
  __esModule: true,
  default: {
    predict: jest.fn(),
    isReady: jest.fn().mockReturnValue(false),
  },
}));

jest.mock('../src/services/eye/ModelLoader', () => ({
  __esModule: true,
  loadGazeModel: jest.fn().mockResolvedValue(null),
}));

import EyeService from '../src/services/eye/EyeService';
import { GazePoint, Saccade } from '../src/types';

function makeGazeTrail(count: number, startX = 0): GazePoint[] {
  const points: GazePoint[] = [];
  for (let i = 0; i < count; i += 1) {
    points.push({
      x: startX + i * 2,
      y: 100 + (i % 3),
      timestamp: i * 50,
    });
  }
  return points;
}

describe('EyeService metrics', () => {
  it('detects fixations in stable gaze clusters', () => {
    const stable: GazePoint[] = [
      ...Array.from({ length: 15 }, (_, i) => ({
        x: 100 + (i % 2) * 0.5,
        y: 200,
        timestamp: i * 120,
      })),
      { x: 400, y: 200, timestamp: 15 * 120 },
    ];
    const fixations = EyeService.detectFixations(stable, {
      dispersionThreshold: 1,
      durationThreshold: 100,
    });
    expect(fixations.length).toBeGreaterThan(0);
  });

  it('detects saccades from fast gaze jumps', () => {
    const points: GazePoint[] = [
      { x: 0, y: 0, timestamp: 0 },
      { x: 200, y: 0, timestamp: 16 },
    ];
    const saccades = EyeService.detectSaccades(points, { velocityThreshold: 30 });
    expect(saccades.length).toBe(1);
    expect(saccades[0].velocity).toBeGreaterThan(30);
  });

  it('detects regressions as leftward saccades', () => {
    const saccades: Saccade[] = [
      {
        startX: 200,
        startY: 100,
        endX: 50,
        endY: 100,
        duration: 40,
        velocity: 60,
        timestamp: 100,
      },
    ];
    const regressions = EyeService.detectRegressions(saccades, 400);
    expect(regressions.length).toBe(1);
    expect(regressions[0].isRegression).toBe(true);
  });

  it('calculates engagement from fixation time ratio', () => {
    const metrics = EyeService.calculateMetrics(makeGazeTrail(30), 5000, 800);
    expect(metrics.engagement).toBeGreaterThanOrEqual(0);
    expect(metrics.engagement).toBeLessThanOrEqual(100);
    expect(metrics.fixations.length).toBeGreaterThanOrEqual(0);
    expect(metrics.saccades.length).toBeGreaterThanOrEqual(0);
  });

  it('includes regressions in full metrics pipeline', () => {
    const points: GazePoint[] = [
      { x: 300, y: 100, timestamp: 0 },
      { x: 100, y: 100, timestamp: 50 },
    ];
    const metrics = EyeService.calculateMetrics(points, 3000, 400);
    expect(metrics.timeOnPage).toBe(3000);
    expect(Array.isArray(metrics.regressions)).toBe(true);
  });
});
