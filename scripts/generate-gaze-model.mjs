/**
 * Generates bundled TF.js gaze-predictor weights for NeuralGazePredictor.
 * Run: node scripts/generate-gaze-model.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'assets', 'models', 'gaze-predictor');

async function main() {
  const tf = await import('@tensorflow/tfjs');
  await tf.ready();

  const model = tf.sequential({
    layers: [
      tf.layers.lstm({
        inputShape: [7, 2],
        units: 16,
        returnSequences: false,
      }),
      tf.layers.dense({ units: 8, activation: 'relu' }),
      tf.layers.dense({ units: 2, activation: 'linear' }),
    ],
  });

  model.compile({ optimizer: 'adam', loss: 'meanSquaredError' });

  fs.mkdirSync(outDir, { recursive: true });

  const artifacts = await model.save(
    tf.io.withSaveHandler(async (modelArtifacts) => {
      const weightsData = modelArtifacts.weightData;
      const weightsBuffer = Array.isArray(weightsData)
        ? Buffer.concat(weightsData.map((a) => Buffer.from(a)))
        : Buffer.from(weightsData);

      const weightsFilename = 'gaze-predictor.weights.bin';
      fs.writeFileSync(path.join(outDir, weightsFilename), weightsBuffer);

      const modelJson = {
        format: 'layers-model',
        generatedBy: 'ReadAssist Pro generate-gaze-model.mjs',
        convertedBy: null,
        modelTopology: modelArtifacts.modelTopology,
        weightsManifest: [
          {
            paths: [weightsFilename],
            weights: modelArtifacts.weightSpecs,
          },
        ],
      };

      fs.writeFileSync(path.join(outDir, 'model.json'), JSON.stringify(modelJson, null, 2));
      return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: 'JSON' } };
    })
  );

  console.log('Gaze predictor model saved to', outDir, artifacts);
  model.dispose();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
