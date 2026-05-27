import Tesseract from 'tesseract.js';
import { OCRResult, OCRWord, BoundingBox } from '../types/DocumentBlock';
import ImagePreprocessingService from '../camera/preprocessing';
import { logger } from '../../logger/Logger';

const MIN_CONFIDENCE = 60;
const WHITELIST_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,;:!?\'"-';

class OCRService {
  private workers: Map<string, Tesseract.Worker> = new Map();

  async initializeWorker(language = 'eng'): Promise<Tesseract.Worker> {
    const workerKey = language;
    if (this.workers.has(workerKey)) {
      return this.workers.get(workerKey)!;
    }

    const worker = await Tesseract.createWorker(language);
    await worker.setParameters({
      tessedit_pageseg_mode: Tesseract.PSM.AUTO,
      tessedit_char_whitelist: WHITELIST_CHARS,
      preserve_interword_spaces: '1',
    });

    this.workers.set(workerKey, worker);
    logger.info('Tesseract worker initialized', { language });
    return worker;
  }

  async detectLanguage(imageUri: string): Promise<string> {
    try {
      const worker = await this.initializeWorker('eng');
      const sample = await worker.recognize(imageUri, {}, { blocks: true });
      const text = sample.data.text.slice(0, 200);
      if (/[áéíóúñ¿¡]/i.test(text)) {
        return 'spa';
      }
      return 'eng';
    } catch {
      return 'eng';
    }
  }

  async recognizeText(
    imageUri: string,
    bbox?: BoundingBox,
    language?: string,
    options?: { preprocess?: boolean; psm?: 'auto' | 'block' | 'line' }
  ): Promise<OCRResult> {
    try {
      let ocrUri = imageUri;
      if (options?.preprocess !== false) {
        const preprocessed = await ImagePreprocessingService.preprocessImage(imageUri);
        ocrUri = preprocessed.ocrOptimizedUri ?? preprocessed.processedUri;
      }

      const detectedLang = language ?? (await this.detectLanguage(ocrUri));
      const worker = await this.initializeWorker(detectedLang);

      if (options?.psm) {
        const psmMap = {
          auto: Tesseract.PSM.AUTO,
          block: Tesseract.PSM.SINGLE_BLOCK,
          line: Tesseract.PSM.SINGLE_LINE,
        };
        await worker.setParameters({
          tessedit_pageseg_mode: psmMap[options.psm],
        });
      }

      const result = await worker.recognize(ocrUri);
      const words: OCRWord[] = (result.data.words ?? [])
        .filter((word) => (word.confidence ?? 0) >= MIN_CONFIDENCE)
        .map((word) => ({
          text: word.text.trim(),
          confidence: word.confidence ?? 0,
          bbox: {
            x: word.bbox.x0,
            y: word.bbox.y0,
            width: word.bbox.x1 - word.bbox.x0,
            height: word.bbox.y1 - word.bbox.y0,
          },
        }))
        .filter((w) => w.text.length > 0);

      const avgConfidence =
        words.length > 0
          ? words.reduce((sum, w) => sum + w.confidence, 0) / words.length
          : result.data.confidence ?? 0;

      return {
        text: this.cleanText(result.data.text),
        confidence: avgConfidence,
        bbox: bbox ?? {
          x: 0,
          y: 0,
          width: (result.data as { width?: number }).width ?? 0,
          height: (result.data as { height?: number }).height ?? 0,
        },
        words,
      };
    } catch (error) {
      logger.error('OCR error', {
        message: error instanceof Error ? error.message : String(error),
      });
      return {
        text: '',
        confidence: 0,
        bbox: bbox ?? { x: 0, y: 0, width: 0, height: 0 },
        words: [],
      };
    }
  }

  async recognizeRegions(
    imageUri: string,
    bboxes: BoundingBox[],
    language?: string
  ): Promise<OCRResult[]> {
    const results: OCRResult[] = [];
    for (const box of bboxes) {
      results.push(
        await this.recognizeText(imageUri, box, language, { preprocess: true, psm: 'block' })
      );
    }
    return results;
  }

  cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[|]/g, 'I')
      .replace(/\b0(?=[a-z])/gi, 'O')
      .trim();
  }

  async terminate(): Promise<void> {
    for (const worker of this.workers.values()) {
      await worker.terminate();
    }
    this.workers.clear();
  }
}

export default new OCRService();
