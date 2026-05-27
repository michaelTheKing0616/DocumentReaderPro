import { BoundingBox, DocumentBlock, OCRWord } from '../types/DocumentBlock';

const LINE_Y_TOLERANCE_RATIO = 0.6;
const PARAGRAPH_GAP_RATIO = 1.4;
const COLUMN_GAP_MIN_RATIO = 0.04;
const MIN_COLUMN_WIDTH_RATIO = 0.2;
const HEADER_REGION_RATIO = 0.12;
const FOOTER_REGION_RATIO = 0.9;
const TITLE_HEIGHT_RATIO = 1.35;

export interface TextLine {
  words: OCRWord[];
  bbox: BoundingBox;
  columnIndex: number;
}

export interface ColumnBoundary {
  x: number;
  width: number;
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function mergeBoundingBoxes(boxes: BoundingBox[]): BoundingBox {
  const minX = Math.min(...boxes.map((b) => b.x));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxX = Math.max(...boxes.map((b) => b.x + b.width));
  const maxY = Math.max(...boxes.map((b) => b.y + b.height));
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function groupWordsIntoLines(words: OCRWord[]): TextLine[] {
  if (words.length === 0) {
    return [];
  }

  const avgWordHeight =
    words.reduce((sum, word) => sum + word.bbox.height, 0) / words.length;
  const yTolerance = Math.max(4, avgWordHeight * LINE_Y_TOLERANCE_RATIO);

  const sorted = [...words].sort((a, b) => {
    const yDiff = a.bbox.y - b.bbox.y;
    if (Math.abs(yDiff) > yTolerance) {
      return yDiff;
    }
    return a.bbox.x - b.bbox.x;
  });

  const lines: TextLine[] = [];
  let currentWords: OCRWord[] = [sorted[0]];
  let currentBaseline = sorted[0].bbox.y + sorted[0].bbox.height / 2;

  for (let i = 1; i < sorted.length; i += 1) {
    const word = sorted[i];
    const wordBaseline = word.bbox.y + word.bbox.height / 2;
    if (Math.abs(wordBaseline - currentBaseline) <= yTolerance) {
      currentWords.push(word);
    } else {
      currentWords.sort((a, b) => a.bbox.x - b.bbox.x);
      lines.push({
        words: currentWords,
        bbox: mergeBoundingBoxes(currentWords.map((w) => w.bbox)),
        columnIndex: 0,
      });
      currentWords = [word];
      currentBaseline = wordBaseline;
    }
  }

  currentWords.sort((a, b) => a.bbox.x - b.bbox.x);
  lines.push({
    words: currentWords,
    bbox: mergeBoundingBoxes(currentWords.map((w) => w.bbox)),
    columnIndex: 0,
  });

  return lines.sort((a, b) => a.bbox.y - b.bbox.y);
}

export function detectColumnBoundaries(
  lines: TextLine[],
  pageWidth: number
): ColumnBoundary[] {
  if (lines.length === 0) {
    return [{ x: 0, width: pageWidth }];
  }

  const centers = lines.map((line) => line.bbox.x + line.bbox.width / 2);
  const minGap = pageWidth * COLUMN_GAP_MIN_RATIO;

  const histogramBuckets = 24;
  const bucketWidth = pageWidth / histogramBuckets;
  const counts = new Array(histogramBuckets).fill(0);

  for (const center of centers) {
    const bucket = Math.min(
      histogramBuckets - 1,
      Math.max(0, Math.floor(center / bucketWidth))
    );
    counts[bucket] += 1;
  }

  let bestSplit: number | null = null;
  let bestValleyScore = 0;

  for (let bucket = 2; bucket < histogramBuckets - 2; bucket += 1) {
    const leftPeak = Math.max(...counts.slice(0, bucket));
    const rightPeak = Math.max(...counts.slice(bucket + 1));
    const valley = counts[bucket];
    const splitX = (bucket + 0.5) * bucketWidth;

    if (splitX < pageWidth * 0.25 || splitX > pageWidth * 0.75) {
      continue;
    }

    const valleyScore = leftPeak + rightPeak - valley * 2;
    if (valleyScore > bestValleyScore && leftPeak > 0 && rightPeak > 0) {
      bestValleyScore = valleyScore;
      bestSplit = splitX;
    }
  }

  if (bestSplit == null || bestValleyScore < 2) {
    return [{ x: 0, width: pageWidth }];
  }

  const leftWidth = bestSplit - minGap / 2;
  const rightX = bestSplit + minGap / 2;
  const rightWidth = pageWidth - rightX;

  if (
    leftWidth < pageWidth * MIN_COLUMN_WIDTH_RATIO ||
    rightWidth < pageWidth * MIN_COLUMN_WIDTH_RATIO
  ) {
    return [{ x: 0, width: pageWidth }];
  }

  return [
    { x: 0, width: leftWidth },
    { x: rightX, width: rightWidth },
  ];
}

export function assignLinesToColumns(
  lines: TextLine[],
  columns: ColumnBoundary[]
): TextLine[] {
  if (columns.length <= 1) {
    return lines.map((line) => ({ ...line, columnIndex: 0 }));
  }

  return lines.map((line) => {
    const centerX = line.bbox.x + line.bbox.width / 2;
    let columnIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    columns.forEach((column, index) => {
      const columnCenter = column.x + column.width / 2;
      const distance = Math.abs(centerX - columnCenter);
      if (distance < bestDistance) {
        bestDistance = distance;
        columnIndex = index;
      }
    });

    return { ...line, columnIndex };
  });
}

function classifyBlockType(
  bbox: BoundingBox,
  pageHeight: number,
  lineHeight: number,
  isFirstBlock: boolean
): DocumentBlock['type'] {
  const relativeY = bbox.y / pageHeight;

  if (isFirstBlock && bbox.height >= lineHeight * TITLE_HEIGHT_RATIO) {
    return 'title';
  }
  if (relativeY <= HEADER_REGION_RATIO) {
    return 'heading';
  }
  if (relativeY >= FOOTER_REGION_RATIO && bbox.height <= lineHeight * 1.2) {
    return 'footer';
  }
  return 'paragraph';
}

export function buildBlocksFromLines(
  lines: TextLine[],
  pageWidth: number,
  pageHeight: number,
  pageIndex: number
): DocumentBlock[] {
  if (lines.length === 0) {
    return [];
  }

  const lineHeights = lines.map((line) => line.bbox.height);
  const medianLineHeight = median(lineHeights);
  const paragraphGap = Math.max(8, medianLineHeight * PARAGRAPH_GAP_RATIO);

  const columns = detectColumnBoundaries(lines, pageWidth);
  const columnLines = assignLinesToColumns(lines, columns);

  const blocks: DocumentBlock[] = [];
  let readingOrder = 0;

  for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
    const linesInColumn = columnLines
      .filter((line) => line.columnIndex === columnIndex)
      .sort((a, b) => a.bbox.y - b.bbox.y);

    let paragraphLines: TextLine[] = [];

    const flushParagraph = () => {
      if (paragraphLines.length === 0) {
        return;
      }

      const bbox = mergeBoundingBoxes(paragraphLines.map((line) => line.bbox));
      const text = paragraphLines
        .map((line) => line.words.map((word) => word.text).join(' '))
        .join('\n')
        .trim();
      const confidence =
        paragraphLines.reduce(
          (sum, line) =>
            sum +
            line.words.reduce((wordSum, word) => wordSum + word.confidence, 0) /
              Math.max(line.words.length, 1),
          0
        ) / paragraphLines.length;

      blocks.push({
        id: `block-${pageIndex}-${readingOrder}`,
        type: classifyBlockType(
          bbox,
          pageHeight,
          medianLineHeight,
          blocks.length === 0
        ),
        bbox,
        text,
        confidence: confidence / 100,
        pageIndex,
        readingOrder,
      });
      readingOrder += 1;
      paragraphLines = [];
    };

    for (const line of linesInColumn) {
      if (paragraphLines.length === 0) {
        paragraphLines.push(line);
        continue;
      }

      const previousLine = paragraphLines[paragraphLines.length - 1];
      const verticalGap = line.bbox.y - (previousLine.bbox.y + previousLine.bbox.height);

      if (verticalGap > paragraphGap) {
        flushParagraph();
      }
      paragraphLines.push(line);
    }

    flushParagraph();
  }

  return blocks.sort((a, b) => a.readingOrder - b.readingOrder);
}

export function buildBlocksFromOcrWords(
  words: OCRWord[],
  pageWidth: number,
  pageHeight: number,
  pageIndex: number
): DocumentBlock[] {
  const lines = groupWordsIntoLines(words);
  return buildBlocksFromLines(lines, pageWidth, pageHeight, pageIndex);
}
