import { Platform } from 'react-native';
import * as tf from '@tensorflow/tfjs';
import { bundleResourceIO } from '../../shims/tfjs-react-native.shim';
import { Asset } from 'expo-asset';
import { isMockDataEnabled } from '../../utils/mockGate';
import { logger } from '../logger/Logger';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const bundledGazeModelJson = require('../../../assets/models/gaze-predictor/model.json');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const bundledGazeWeights = require('../../../assets/models/gaze-predictor/gaze-predictor.weights.bin');

/** Optional remote manifests — set via EXPO_PUBLIC_* env vars. */
function resolveRemoteModelUrl(modelName: string): string | null {
  switch (modelName) {
    case 'Gaze360':
      return process.env.EXPO_PUBLIC_GAZE360_MODEL_URL ?? null;
    case 'MobileGaze':
      return process.env.EXPO_PUBLIC_MOBILEGAZE_MODEL_URL ?? null;
    case 'GaTector':
      return process.env.EXPO_PUBLIC_GATECTOR_MODEL_URL ?? null;
    case 'Gazelle':
      return process.env.EXPO_PUBLIC_GAZELLE_MODEL_URL ?? null;
    default:
      return null;
  }
}

const PLACEHOLDER_INPUT_DIM = 4;
const PLACEHOLDER_OUTPUT_DIM = 2;

export class ModelLoader {
  private loadedModels: Map<string, tf.LayersModel> = new Map();
  private loadingPromises: Map<string, Promise<tf.LayersModel | null>> = new Map();

  async loadOpenModel(modelName: string): Promise<tf.LayersModel | null> {
    if (this.loadedModels.has(modelName)) {
      return this.loadedModels.get(modelName)!;
    }

    const inFlight = this.loadingPromises.get(modelName);
    if (inFlight) {
      return inFlight;
    }

    const loadPromise = this.loadModelInternal(modelName);
    this.loadingPromises.set(modelName, loadPromise);

    try {
      return await loadPromise;
    } finally {
      this.loadingPromises.delete(modelName);
    }
  }

  async loadGaze360Model(): Promise<tf.LayersModel | null> {
    return this.loadOpenModel('Gaze360');
  }

  async loadBundledGazePredictor(): Promise<tf.LayersModel | null> {
    const cacheKey = 'BundledGazePredictor';
    if (this.loadedModels.has(cacheKey)) {
      return this.loadedModels.get(cacheKey)!;
    }

    const inFlight = this.loadingPromises.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    const loadPromise = this.loadBundledGazePredictorInternal();
    this.loadingPromises.set(cacheKey, loadPromise);

    try {
      return await loadPromise;
    } finally {
      this.loadingPromises.delete(cacheKey);
    }
  }

  private async loadBundledGazePredictorInternal(): Promise<tf.LayersModel | null> {
    try {
      await tf.ready();

      if (Platform.OS === 'web') {
        const [jsonAsset, weightsAsset] = await Promise.all([
          Asset.fromModule(bundledGazeModelJson),
          Asset.fromModule(bundledGazeWeights),
        ]);
        await Promise.all([jsonAsset.downloadAsync(), weightsAsset.downloadAsync()]);
      }

      const model = await tf.loadLayersModel(
        bundleResourceIO(bundledGazeModelJson, bundledGazeWeights)
      );
      this.loadedModels.set('BundledGazePredictor', model);
      logger.info('ModelLoader loaded bundled gaze predictor');
      return model;
    } catch (error) {
      logger.warn('ModelLoader bundled gaze predictor unavailable', { error: String(error) });
      return null;
    }
  }

  getModel(modelName: string): tf.LayersModel | null {
    return this.loadedModels.get(modelName) ?? null;
  }

  isModelLoaded(modelName: string): boolean {
    return this.loadedModels.has(modelName);
  }

  clearModels(): void {
    this.loadedModels.forEach((model) => model.dispose());
    this.loadedModels.clear();
    logger.debug('ModelLoader cleared all models');
  }

  private resolveRemoteManifest(modelName: string): string | null {
    const url = resolveRemoteModelUrl(modelName);
    return url && url.length > 0 ? url : null;
  }

  private async loadModelInternal(modelName: string): Promise<tf.LayersModel | null> {
    try {
      let model: tf.LayersModel | null = null;

      if (!isMockDataEnabled()) {
        model = await this.loadBundledGazePredictor();
        if (model) {
          this.loadedModels.set(modelName, model);
          logger.info('ModelLoader using bundled gaze weights', { modelName });
          return model;
        }

        const remoteUrl = this.resolveRemoteManifest(modelName);
        if (remoteUrl) {
          model = await this.loadFromManifest(remoteUrl);
        }
      }

      if (!model) {
        logger.warn('ModelLoader using local fallback weights', { modelName });
        model = await this.createFallbackModel();
      }

      this.loadedModels.set(modelName, model);
      logger.info('ModelLoader model ready', { modelName });
      return model;
    } catch (error) {
      logger.error('ModelLoader load failed', { modelName, error: String(error) });
      return null;
    }
  }

  private async loadFromManifest(manifestUrl: string): Promise<tf.LayersModel | null> {
    try {
      await tf.ready();
      const model = await tf.loadLayersModel(manifestUrl);
      logger.info('ModelLoader loaded remote gaze weights', { manifestUrl });
      return model;
    } catch (error) {
      logger.warn('ModelLoader manifest load failed', {
        manifestUrl,
        error: String(error),
      });
      return null;
    }
  }

  /** Small dense fallback when bundled/remote weights are unavailable (dev-lab only). */
  private async createFallbackModel(): Promise<tf.LayersModel> {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [PLACEHOLDER_INPUT_DIM],
          units: 16,
          activation: 'relu',
        }),
        tf.layers.dense({ units: 8, activation: 'relu' }),
        tf.layers.dense({ units: PLACEHOLDER_OUTPUT_DIM, activation: 'linear' }),
      ],
    });

    model.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError',
    });

    return model;
  }
}

export default new ModelLoader();
