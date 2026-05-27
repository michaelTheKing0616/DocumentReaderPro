import {
  buildBlocksFromOcrWords,
  detectColumnBoundaries,
  groupWordsIntoLines,
} from '../src/services/truescan/vision/columnDetection';
import { OCRWord } from '../src/services/truescan/types/DocumentBlock';

function word(text: string, x: number, y: number, width = 40, height = 14): OCRWord {
  return {
    text,
    confidence: 90,
    bbox: { x, y, width, height },
  };
}

describe('columnDetection', () => {
  it('groups OCR words into reading lines', () => {
    const lines = groupWordsIntoLines([
      word('Hello', 100, 100),
      word('world', 150, 100),
      word('Next', 100, 130),
    ]);

    expect(lines).toHaveLength(2);
    expect(lines[0].words.map((w) => w.text).join(' ')).toBe('Hello world');
    expect(lines[1].words[0].text).toBe('Next');
  });

  it('detects two-column layout from line positions', () => {
    const lines = [
      { words: [word('Left', 80, 100)], bbox: { x: 80, y: 100, width: 40, height: 14 }, columnIndex: 0 },
      { words: [word('Right', 420, 100)], bbox: { x: 420, y: 100, width: 50, height: 14 }, columnIndex: 0 },
      { words: [word('Left2', 85, 130)], bbox: { x: 85, y: 130, width: 45, height: 14 }, columnIndex: 0 },
      { words: [word('Right2', 425, 130)], bbox: { x: 425, y: 130, width: 55, height: 14 }, columnIndex: 0 },
    ];

    const columns = detectColumnBoundaries(lines, 600);
    expect(columns.length).toBe(2);
  });

  it('builds ordered blocks from OCR words', () => {
    const blocks = buildBlocksFromOcrWords(
      [
        word('Title', 200, 40, 80, 24),
        word('Column', 80, 120),
        word('one', 140, 120),
        word('Column', 380, 120),
        word('two', 440, 120),
      ],
      600,
      800,
      0
    );

    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks[0].text).toContain('Title');
  });
});
