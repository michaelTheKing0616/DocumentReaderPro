/**
 * Web shim for pdfjs-dist — loads PDF.js from CDN to avoid Metro bundling issues.
 */

type PdfDocumentProxy = {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPageProxy>;
};

type PdfPageProxy = {
  getTextContent(): Promise<{ items: Array<{ str?: string }> }>;
};

type PdfJsModule = {
  version: string;
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(src: { data: Uint8Array }): { promise: Promise<PdfDocumentProxy> };
};

export const version = '4.10.38';
const CDN_BASE = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}`;

export const GlobalWorkerOptions = {
  workerSrc: `${CDN_BASE}/pdf.worker.min.mjs`,
};

let pdfjsLib: PdfJsModule | null = null;
let loadPromise: Promise<PdfJsModule> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('PDF.js web shim requires a browser document'));
      return;
    }
    const existing = document.querySelector(`script[data-pdfjs="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.type = 'module';
    script.dataset.pdfjs = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

async function ensurePdfJs(): Promise<PdfJsModule> {
  if (pdfjsLib) return pdfjsLib;
  if (!loadPromise) {
    loadPromise = (async () => {
      await loadScript(`${CDN_BASE}/pdf.min.mjs`);
      const globalLib = (window as unknown as { pdfjsLib?: PdfJsModule }).pdfjsLib;
      if (!globalLib) {
        throw new Error('PDF.js failed to initialize on web');
      }
      globalLib.GlobalWorkerOptions.workerSrc = GlobalWorkerOptions.workerSrc;
      pdfjsLib = globalLib;
      return globalLib;
    })();
  }
  return loadPromise;
}

export async function getDocument(src: { data: Uint8Array }) {
  const lib = await ensurePdfJs();
  return lib.getDocument(src);
}
