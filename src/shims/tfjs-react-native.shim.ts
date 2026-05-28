import * as tf from '@tensorflow/tfjs';
import { Asset } from 'expo-asset';

type BundledModelJson = {
  modelTopology: tf.io.ModelArtifacts['modelTopology'];
  format?: string;
  generatedBy?: string;
  convertedBy?: string;
  weightsManifest: Array<{ paths: string[]; weights: tf.io.WeightsManifestEntry[] }>;
};

/**
 * Expo-compatible bundleResourceIO without react-native-fs (removed for EAS builds).
 */
export function bundleResourceIO(
  modelJsonModule: BundledModelJson | number,
  weightsBinaryModule: number
): tf.io.IOHandler {
  return {
    load: async () => {
      const modelJson =
        typeof modelJsonModule === 'number'
          ? await loadJsonAsset(modelJsonModule)
          : modelJsonModule;

      const weightsAsset = Asset.fromModule(weightsBinaryModule);
      await weightsAsset.downloadAsync();
      const weightsUri = weightsAsset.localUri ?? weightsAsset.uri;
      if (!weightsUri) {
        throw new Error('Unable to resolve bundled model weights asset');
      }

      const response = await fetch(weightsUri);
      const weightData = new Uint8Array(await response.arrayBuffer());

      return {
        modelTopology: modelJson.modelTopology,
        format: modelJson.format,
        generatedBy: modelJson.generatedBy,
        convertedBy: modelJson.convertedBy,
        weightSpecs: modelJson.weightsManifest[0].weights,
        weightData,
      };
    },
  };
}

async function loadJsonAsset(moduleId: number): Promise<BundledModelJson> {
  const asset = Asset.fromModule(moduleId);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  if (!uri) {
    throw new Error('Unable to resolve bundled model JSON asset');
  }
  const response = await fetch(uri);
  return (await response.json()) as BundledModelJson;
}

export async function fetchBundle(): Promise<void> {
  await tf.ready();
}

export function asyncStorageIO(_key: string): tf.io.IOHandler {
  throw new Error('@tensorflow/tfjs-react-native asyncStorageIO is not available in this shim');
}
