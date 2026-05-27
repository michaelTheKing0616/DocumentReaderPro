import Tesseract from 'tesseract.js';
import { DocumentParser, ParsedDocument } from '../types';
import { logger } from '../../logger/Logger';

const CHARS_PER_PAGE = 3000;

function splitIntoPages(text: string): ParsedDocument['pages'] {
  const pages: NonNullable<ParsedDocument['pages']> = [];
  let pageNumber = 1;

  for (let offset = 0; offset < text.length; offset += CHARS_PER_PAGE) {
    pages.push({
      pageNumber,
      text: text.slice(offset, offset + CHARS_PER_PAGE),
    });
    pageNumber += 1;
  }

  return pages.length > 0 ? pages : [{ pageNumber: 1, text: '' }];
}

class ImageParser implements DocumentParser {
  private worker: Tesseract.Worker | null = null;

  private async getWorker(): Promise<Tesseract.Worker> {
    if (this.worker) {
      return this.worker;
    }
    const worker = await Tesseract.createWorker('eng');
    await worker.setParameters({
      tessedit_pageseg_mode: Tesseract.PSM.AUTO,
    });
    this.worker = worker;
    return worker;
  }

  async parse(filePath: string): Promise<ParsedDocument> {
    try {
      const worker = await this.getWorker();
      const result = await worker.recognize(filePath);
      const text = (result.data.text ?? '')
        .replace(/\s+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      const pages = splitIntoPages(text);

      return {
        text,
        pageCount: Math.max(pages.length, 1),
        pages,
      };
    } catch (error) {
      logger.error('ImageParser OCR failed', {
        filePath,
        message: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to OCR image: ${filePath}`);
    }
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}

export default new ImageParser();
