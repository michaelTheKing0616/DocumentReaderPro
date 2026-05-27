import LayoutDetectionService from '../src/services/truescan/vision/layoutDetection';
import OCRService from '../src/services/truescan/ocr/ocrService';
import { OCRWord } from '../src/services/truescan/types/DocumentBlock';

jest.mock('../src/services/truescan/ocr/ocrService', () => ({
  __esModule: true,
  default: {
    recognizeText: jest.fn(),
  },
}));

const mockRecognizeText = OCRService.recognizeText as jest.MockedFunction<
  typeof OCRService.recognizeText
>;

function word(text: string, x: number, y: number): OCRWord {
  return {
    text,
    confidence: 92,
    bbox: { x, y, width: 48, height: 14 },
  };
}

describe('LayoutDetectionService OCR layout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds column-aware blocks from OCR word bounding boxes', async () => {
    mockRecognizeText.mockResolvedValue({
      text: 'Left column Right column',
      confidence: 88,
      bbox: { x: 0, y: 0, width: 600, height: 800 },
      words: [
        word('Left', 80, 120),
        word('column', 140, 120),
        word('Right', 380, 120),
        word('column', 450, 120),
        word('Footer', 200, 760),
      ],
    });

    const result = await LayoutDetectionService.detectLayout(
      'file:///page.jpg',
      600,
      800,
      0
    );

    expect(mockRecognizeText).toHaveBeenCalled();
    expect(result.blocks.length).toBeGreaterThan(0);
    expect(result.blocks.some((block) => block.text?.includes('Left'))).toBe(true);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('falls back to a single block when OCR returns too few words', async () => {
    mockRecognizeText.mockResolvedValue({
      text: 'Sparse',
      confidence: 70,
      bbox: { x: 0, y: 0, width: 400, height: 600 },
      words: [word('Sparse', 50, 50)],
    });

    const result = await LayoutDetectionService.detectLayout(
      'file:///sparse.jpg',
      400,
      600,
      1
    );

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].text).toBe('Sparse');
  });
});
