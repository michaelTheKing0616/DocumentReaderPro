import * as tf from '@tensorflow/tfjs';
import { GazePoint } from '../../types';
import { getScreenDimensions } from '../../utils/dimensions';
import { logger } from '../logger/Logger';
import ModelLoader from './ModelLoader';

const FRAME_WINDOW = 7;
const DEFAULT_HORIZON_MS = 100;
const HISTORY_CAP = FRAME_WINDOW * 4;

export class NeuralGazePredictor {
  private model: tf.LayersModel | null = null;
  private gazeHistory: GazePoint[] = [];
  private initialized = false;

  get frameWindow(): number {
    return FRAME_WINDOW;
  }

  async initialize(): Promise<void> {
    if (this.initialized && this.model) {
      return;
    }

    await tf.ready();
    this.model =
      (await ModelLoader.loadBundledGazePredictor()) ??
      (await ModelLoader.loadOpenModel('Gaze360')) ??
      (await this.createFallbackModel());

    this.initialized = true;
    logger.debug('NeuralGazePredictor initialized', { frameWindow: FRAME_WINDOW });
  }

  async predictNextGaze(horizonMs: number = DEFAULT_HORIZON_MS): Promise<GazePoint | null> {
    if (this.gazeHistory.length < FRAME_WINDOW) {
      return null;
    }

    await this.initialize();
    if (!this.model) {
      return this.extrapolateLinear(horizonMs);
    }

    const { width, height } = getScreenDimensions();
    const sequence = this.gazeHistory.slice(-FRAME_WINDOW).map((point) => [
      point.x / Math.max(width, 1),
      point.y / Math.max(height, 1),
    ]);

    const input = tf.tensor3d([sequence]);
    const prediction = this.model.predict(input) as tf.Tensor;
    const [predXNorm, predYNorm] = await prediction.data();

    input.dispose();
    prediction.dispose();

    return {
      x: predXNorm * width,
      y: predYNorm * height,
      timestamp: Date.now() + horizonMs,
    };
  }

  addGazePoint(point: GazePoint): void {
    this.gazeHistory.push(point);
    if (this.gazeHistory.length > HISTORY_CAP) {
      this.gazeHistory.shift();
    }
  }

  clearHistory(): void {
    this.gazeHistory = [];
  }

  getHistory(): GazePoint[] {
    return [...this.gazeHistory];
  }

  hasEnoughHistory(): boolean {
    return this.gazeHistory.length >= FRAME_WINDOW;
  }

  private async createFallbackModel(): Promise<tf.LayersModel> {
    const model = tf.sequential({
      layers: [
        tf.layers.lstm({
          inputShape: [FRAME_WINDOW, 2],
          units: 16,
          returnSequences: false,
        }),
        tf.layers.dense({ units: 8, activation: 'relu' }),
        tf.layers.dense({ units: 2, activation: 'linear' }),
      ],
    });

    model.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError',
    });

    return model;
  }

  private extrapolateLinear(horizonMs: number): GazePoint | null {
    if (this.gazeHistory.length < 2) {
      return null;
    }

    const prev = this.gazeHistory[this.gazeHistory.length - 2];
    const curr = this.gazeHistory[this.gazeHistory.length - 1];
    const dt = Math.max(curr.timestamp - prev.timestamp, 1);
    const scale = horizonMs / dt;

    return {
      x: curr.x + (curr.x - prev.x) * scale,
      y: curr.y + (curr.y - prev.y) * scale,
      timestamp: Date.now() + horizonMs,
    };
  }
}

export default new NeuralGazePredictor();
