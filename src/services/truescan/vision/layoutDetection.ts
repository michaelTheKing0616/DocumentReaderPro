import {
  DocumentBlock,
  LayoutDetectionResult,
  BoundingBox,
} from '../types/DocumentBlock';
import OCRService from '../ocr/ocrService';
import { buildBlocksFromOcrWords } from './columnDetection';
import { logger } from '../../logger/Logger';

const MIN_OCR_WORDS_FOR_LAYOUT = 3;
const FALLBACK_BLOCK_CONFIDENCE = 0.55;

class LayoutDetectionService {
  // Detect layout blocks using OCR word bounding boxes and column clustering.
  async detectLayout(
    imageUri: string,
    width: number,
    height: number,
    pageIndex = 0
  ): Promise<LayoutDetectionResult> {
    try {
      const ocrResult = await OCRService.recognizeText(imageUri, undefined, undefined, {
        preprocess: true,
        psm: 'auto',
      });

      if (ocrResult.words.length >= MIN_OCR_WORDS_FOR_LAYOUT) {
        const blocks = buildBlocksFromOcrWords(
          ocrResult.words,
          width,
          height,
          pageIndex
        );

        return {
          blocks: this.mergeOverlappingBlocks(blocks),
          tables: [],
          images: [],
          confidence: Math.min(1, ocrResult.confidence / 100),
        };
      }

      logger.warn('OCR returned too few words; using single-block fallback', {
        wordCount: ocrResult.words.length,
      });
      return this.singleBlockFallback(width, height, pageIndex, ocrResult.text, ocrResult.confidence);
    } catch (error) {
      logger.error('OCR-based layout detection failed', {
        message: error instanceof Error ? error.message : String(error),
      });
      return this.singleBlockFallback(width, height, pageIndex);
    }
  }

  private singleBlockFallback(
    width: number,
    height: number,
    pageIndex: number,
    text = '',
    confidence = 0
  ): LayoutDetectionResult {
    const marginX = width * 0.08;
    const marginY = height * 0.08;

    const block: DocumentBlock = {
      id: `block-${pageIndex}-0`,
      type: 'paragraph',
      bbox: {
        x: marginX,
        y: marginY,
        width: width - marginX * 2,
        height: height - marginY * 2,
      },
      text: text.trim(),
      confidence: confidence > 0 ? confidence / 100 : FALLBACK_BLOCK_CONFIDENCE,
      pageIndex,
      readingOrder: 0,
    };

    return {
      blocks: [block],
      tables: [],
      images: [],
      confidence: block.confidence,
    };
  }

  async detectTables(
    _imageUri: string,
    _width: number,
    _height: number
  ): Promise<LayoutDetectionResult['tables']> {
    return [];
  }

  async detectImages(
    _imageUri: string,
    _width: number,
    _height: number
  ): Promise<LayoutDetectionResult['images']> {
    return [];
  }

  mergeOverlappingBlocks(blocks: DocumentBlock[]): DocumentBlock[] {
    const merged: DocumentBlock[] = [];
    const processed = new Set<string>();

    for (const block of blocks) {
      if (processed.has(block.id)) continue;

      const overlapping = blocks.filter((b) => {
        if (b.id === block.id || processed.has(b.id)) return false;
        return this.isOverlapping(block.bbox, b.bbox);
      });

      if (overlapping.length > 0) {
        const mergedBlock = this.mergeBlocks([block, ...overlapping]);
        merged.push(mergedBlock);
        overlapping.forEach((b) => processed.add(b.id));
      } else {
        merged.push(block);
      }

      processed.add(block.id);
    }

    return merged;
  }

  private isOverlapping(bbox1: BoundingBox, bbox2: BoundingBox): boolean {
    return !(
      bbox1.x + bbox1.width < bbox2.x ||
      bbox2.x + bbox2.width < bbox1.x ||
      bbox1.y + bbox1.height < bbox2.y ||
      bbox2.y + bbox2.height < bbox1.y
    );
  }

  private mergeBlocks(blocks: DocumentBlock[]): DocumentBlock {
    const minX = Math.min(...blocks.map((b) => b.bbox.x));
    const minY = Math.min(...blocks.map((b) => b.bbox.y));
    const maxX = Math.max(...blocks.map((b) => b.bbox.x + b.bbox.width));
    const maxY = Math.max(...blocks.map((b) => b.bbox.y + b.bbox.height));

    const mergedText = blocks
      .sort((a, b) => a.readingOrder - b.readingOrder)
      .map((b) => b.text ?? '')
      .filter(Boolean)
      .join('\n');

    const dominantBlock = blocks.reduce(
      (best, block) => (block.confidence > best.confidence ? block : best),
      blocks[0]
    );

    return {
      ...dominantBlock,
      type: dominantBlock.type,
      bbox: {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      },
      text: mergedText,
      confidence: blocks.reduce((sum, b) => sum + b.confidence, 0) / blocks.length,
    };
  }
}

export default new LayoutDetectionService();
