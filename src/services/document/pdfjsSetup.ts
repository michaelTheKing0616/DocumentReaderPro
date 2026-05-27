import { Platform } from 'react-native';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

let configured = false;

export function configurePdfJs(): typeof pdfjsLib {
  if (!configured) {
    if (Platform.OS === 'web') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    } else {
      // Metro bundles the worker for native targets.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      pdfjsLib.GlobalWorkerOptions.workerSrc = require('pdfjs-dist/legacy/build/pdf.worker.js');
    }
    configured = true;
  }
  return pdfjsLib;
}

export type PdfJsLib = typeof pdfjsLib;
