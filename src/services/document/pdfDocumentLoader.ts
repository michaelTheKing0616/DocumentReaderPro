import { Platform } from 'react-native';
import { ensurePdfJsConfigured } from './pdfjsSetup';
import { readFileAsUint8Array } from './pdfBytes';
import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';

export async function loadPdfDocument(filePath: string): Promise<PDFDocumentProxy> {
  const pdfjs = await ensurePdfJsConfigured();

  if (Platform.OS === 'web' && /^https?:\/\//.test(filePath)) {
    const loadingTask = pdfjs.getDocument(filePath);
    return loadingTask.promise;
  }

  const bytes = await readFileAsUint8Array(filePath);
  const loadingTask = pdfjs.getDocument({ data: bytes });
  return loadingTask.promise;
}
