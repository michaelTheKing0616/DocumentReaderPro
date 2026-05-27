import * as tf from '@tensorflow/tfjs';

/**
 * Web shim for @tensorflow/tfjs-react-native bundleResourceIO.
 * Loads model JSON + weights binary bundled by Metro.
 */
export function bundleResourceIO(
  modelJson: Record<string, unknown>,
  weightsBinary: ArrayBuffer | { uri?: string; default?: ArrayBuffer }
): tf.io.IOHandler {
  const buffer =
    weightsBinary instanceof ArrayBuffer
      ? weightsBinary
      : (weightsBinary as { default?: ArrayBuffer }).default ?? new ArrayBuffer(0);

  const weightData = new Uint8Array(buffer);
  const artifacts: tf.io.ModelArtifacts = {
    modelTopology: modelJson.modelTopology as tf.io.ModelArtifacts['modelTopology'],
    format: modelJson.format as string | undefined,
    generatedBy: modelJson.generatedBy as string | undefined,
    convertedBy: modelJson.convertedBy as string | undefined,
    weightsManifest: modelJson.weightsManifest as tf.io.WeightsManifestEntry[] | undefined,
    weightData,
  };

  return {
    load: async () => artifacts,
  };
}

export async function fetchBundle(): Promise<void> {
  await tf.ready();
}

export function asyncStorageIO(_key: string): tf.io.IOHandler {
  throw new Error('@tensorflow/tfjs-react-native asyncStorageIO is not available on web');
}
