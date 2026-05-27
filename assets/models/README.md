# TensorFlow.js Model Weights

Bundled open-weight models for on-device inference in ReadAssist Pro.

## Gaze predictor (`gaze-predictor/`)

LSTM sequence model for neural gaze prediction (`NeuralGazePredictor`):

- **Input**: 7 gaze frames × 2 normalized coordinates (x, y)
- **Output**: Predicted next gaze point (normalized x, y)
- **Files**: `model.json`, `gaze-predictor.weights.bin`

### Regenerate weights

After changing the architecture in `NeuralGazePredictor.ts`, regenerate bundled weights:

```bash
node scripts/generate-gaze-model.mjs
```

### Adding new models

1. Create a subfolder under `assets/models/<model-name>/`
2. Place `model.json` and weight shard(s) (`.bin`) in that folder
3. Register the loader in `src/services/eye/ModelLoader.ts`
4. Add `.bin` to `metro.config.js` `assetExts` if not already present

### Production weights

Replace the scaffold LSTM with fine-tuned Gaze360/MobileGaze weights by exporting a compatible TF.js LayersModel and overwriting the files in `gaze-predictor/`. Input shape must remain `[7, 2]` or update `FRAME_WINDOW` in `NeuralGazePredictor.ts` to match.
