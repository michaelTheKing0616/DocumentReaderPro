import {
  DocumentBlock,
  DocumentStructure,
  PageModel,
  BlockType,
} from '../types/DocumentBlock';
import { OCRResult } from '../types/DocumentBlock';

class StructureBuilderService {
  // Build document structure from OCR results and layout
  buildStructure(
    pages: {
      imageUri: string;
      width: number;
      height: number;
      blocks: DocumentBlock[];
      ocrResults: OCRResult[];
      tables: any[];
      images: any[];
    }[]
  ): DocumentStructure {
    const pageModels: PageModel[] = pages.map((page, index) => ({
      pageIndex: index,
      imageUri: page.imageUri,
      width: page.width,
      height: page.height,
      blocks: this.mergeOCRIntoBlocks(page.blocks, page.ocrResults),
      tables: page.tables,
      images: page.images,
    }));

    return {
      pages: pageModels,
      metadata: {
        createdAt: new Date(),
      },
    };
  }

  // Merge OCR results into document blocks
  private mergeOCRIntoBlocks(
    blocks: DocumentBlock[],
    ocrResults: OCRResult[]
  ): DocumentBlock[] {
    const merged: DocumentBlock[] = [];

    for (const block of blocks) {
      // Find OCR result that matches this block
      const matchingOCR = ocrResults.find((ocr) =>
        this.isBlockInOCR(block, ocr)
      );

      if (matchingOCR) {
        merged.push({
          ...block,
          text: this.cleanText(matchingOCR.text),
          confidence: (block.confidence + matchingOCR.confidence) / 2,
        });
      } else {
        merged.push(block);
      }
    }

    return merged;
  }

  // Check if block is within OCR region
  private isBlockInOCR(block: DocumentBlock, ocr: OCRResult): boolean {
    const blockCenterX = block.bbox.x + block.bbox.width / 2;
    const blockCenterY = block.bbox.y + block.bbox.height / 2;

    return (
      blockCenterX >= ocr.bbox.x &&
      blockCenterX <= ocr.bbox.x + ocr.bbox.width &&
      blockCenterY >= ocr.bbox.y &&
      blockCenterY <= ocr.bbox.y + ocr.bbox.height
    );
  }

  // Clean and format text
  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // Infer heading levels
  inferHeadingLevels(blocks: DocumentBlock[]): DocumentBlock[] {
    let currentLevel = 1;
    let lastHeadingType: BlockType | null = null;

    return blocks.map((block) => {
      if (block.type === 'heading' || block.type === 'title') {
        if (lastHeadingType === null) {
          currentLevel = 1;
        } else if (block.type === 'title') {
          currentLevel = 0; // Title is level 0
        } else {
          // Increment level for nested headings
          currentLevel++;
        }
        lastHeadingType = block.type;

        return {
          ...block,
          style: {
            ...block.style,
            fontSize: 24 - currentLevel * 2, // Decrease font size for deeper levels
            fontWeight: 'bold',
          },
        };
      }

      return block;
    });
  }

  // Merge broken lines into paragraphs
  mergeParagraphs(blocks: DocumentBlock[]): DocumentBlock[] {
    const merged: DocumentBlock[] = [];
    let currentParagraph: DocumentBlock[] = [];

    for (const block of blocks) {
      if (block.type === 'paragraph') {
        currentParagraph.push(block);
      } else {
        // Merge accumulated paragraphs
        if (currentParagraph.length > 0) {
          merged.push(this.mergeBlocksIntoParagraph(currentParagraph));
          currentParagraph = [];
        }
        merged.push(block);
      }
    }

    // Merge remaining paragraphs
    if (currentParagraph.length > 0) {
      merged.push(this.mergeBlocksIntoParagraph(currentParagraph));
    }

    return merged;
  }

  // Merge multiple blocks into single paragraph
  private mergeBlocksIntoParagraph(blocks: DocumentBlock[]): DocumentBlock {
    const texts = blocks
      .map((b) => b.text || '')
      .filter((t) => t.length > 0)
      .join(' ');

    const minX = Math.min(...blocks.map((b) => b.bbox.x));
    const minY = Math.min(...blocks.map((b) => b.bbox.y));
    const maxX = Math.max(...blocks.map((b) => b.bbox.x + b.bbox.width));
    const maxY = Math.max(...blocks.map((b) => b.bbox.y + b.bbox.height));

    return {
      ...blocks[0],
      id: `merged-${blocks[0].id}`,
      text: texts,
      bbox: {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      },
      confidence: blocks.reduce((sum, b) => sum + b.confidence, 0) / blocks.length,
    };
  }

  // Detect and structure lists
  detectLists(blocks: DocumentBlock[]): DocumentBlock[] {
    const processed: DocumentBlock[] = [];
    let currentList: DocumentBlock[] = [];

    for (const block of blocks) {
      // Check if block looks like a list item (starts with bullet, number, dash)
      const text = block.text || '';
      const isListItem = /^[\u2022\u2023\u25E6\u2043\u2219\-\*\+]\s|^\d+[\.\)]\s/.test(text);

      if (isListItem) {
        currentList.push({
          ...block,
          type: 'list-item',
        });
      } else {
        // End current list
        if (currentList.length > 0) {
          processed.push({
            id: `list-${Date.now()}`,
            type: 'list',
            bbox: this.mergeBoundingBoxes(currentList.map((b) => b.bbox)),
            confidence: 0.8,
            pageIndex: currentList[0].pageIndex,
            readingOrder: currentList[0].readingOrder,
            children: currentList,
          });
          currentList = [];
        }
        processed.push(block);
      }
    }

    // Add remaining list
    if (currentList.length > 0) {
      processed.push({
        id: `list-${Date.now()}`,
        type: 'list',
        bbox: this.mergeBoundingBoxes(currentList.map((b) => b.bbox)),
        confidence: 0.8,
        pageIndex: currentList[0].pageIndex,
        readingOrder: currentList[0].readingOrder,
        children: currentList,
      });
    }

    return processed;
  }

  // Merge multiple bounding boxes
  private mergeBoundingBoxes(bboxes: DocumentBlock['bbox'][]): DocumentBlock['bbox'] {
    const minX = Math.min(...bboxes.map((b) => b.x));
    const minY = Math.min(...bboxes.map((b) => b.y));
    const maxX = Math.max(...bboxes.map((b) => b.x + b.width));
    const maxY = Math.max(...bboxes.map((b) => b.y + b.height));

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  // Establish reading order (top-to-bottom, left-to-right)
  establishReadingOrder(blocks: DocumentBlock[]): DocumentBlock[] {
    return [...blocks].sort((a, b) => {
      // First by Y (top to bottom)
      const yDiff = a.bbox.y - b.bbox.y;
      if (Math.abs(yDiff) > 20) {
        return yDiff;
      }
      // Then by X (left to right)
      return a.bbox.x - b.bbox.x;
    }).map((block, index) => ({
      ...block,
      readingOrder: index,
    }));
  }
}

export default new StructureBuilderService();
















