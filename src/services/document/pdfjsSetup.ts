import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
// Minified legacy build avoids dynamic import() in pdf.mjs that breaks Metro on Android.
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.min.mjs';

let configured = false;
let configurePromise: Promise<typeof pdfjsLib> | null = null;

async function configureNativeWorker(): Promise<void> {
  const workerModule = require('pdfjs-dist/legacy/build/pdf.worker.min.mjs');
  const asset = Asset.fromModule(workerModule);
  await asset.downloadAsync();
  pdfjsLib.GlobalWorkerOptions.workerSrc = asset.localUri ?? asset.uri;
}

/** Configure PDF.js once. Native callers should await this before parsing. */
export async function ensurePdfJsConfigured(): Promise<typeof pdfjsLib> {
  if (configured) {
    return pdfjsLib;
  }
  if (!configurePromise) {
    configurePromise = (async () => {
      if (Platform.OS === 'web') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
      } else {
        await configureNativeWorker();
      }
      configured = true;
      return pdfjsLib;
    })();
  }
  return configurePromise;
}

/** @deprecated Prefer ensurePdfJsConfigured() on native. */
export function configurePdfJs(): typeof pdfjsLib {
  if (!configured && Platform.OS === 'web') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
    configured = true;
  }
  return pdfjsLib;
}

export type PdfJsLib = typeof pdfjsLib;
