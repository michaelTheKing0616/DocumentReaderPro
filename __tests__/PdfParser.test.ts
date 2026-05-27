import PdfParser from '../src/services/document/parsers/PdfParser';

jest.mock('../src/services/document/pdfDocumentLoader', () => ({
  loadPdfDocument: jest.fn(),
}));

import { loadPdfDocument } from '../src/services/document/pdfDocumentLoader';

const mockLoadPdfDocument = loadPdfDocument as jest.MockedFunction<typeof loadPdfDocument>;

describe('PdfParser integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('parses multi-page PDF text content', async () => {
    mockLoadPdfDocument.mockResolvedValue({
      numPages: 2,
      getPage: jest.fn(async (pageNumber: number) => ({
        getTextContent: jest.fn(async () => ({
          items: [
            { str: pageNumber === 1 ? 'Hello' : 'World' },
            { str: pageNumber === 1 ? 'page' : 'two' },
          ],
        })),
      })),
    } as never);

    const result = await PdfParser.parse('file:///docs/sample.pdf');

    expect(mockLoadPdfDocument).toHaveBeenCalledWith('file:///docs/sample.pdf');
    expect(result.pageCount).toBe(2);
    expect(result.pages).toHaveLength(2);
    expect(result.pages?.[0].text).toBe('Hello page');
    expect(result.pages?.[1].text).toBe('World two');
    expect(result.text).toBe('Hello page\n\nWorld two');
  });

  it('throws a readable error when PDF loading fails', async () => {
    mockLoadPdfDocument.mockRejectedValue(new Error('corrupt pdf'));

    await expect(PdfParser.parse('file:///docs/broken.pdf')).rejects.toThrow(
      'Failed to parse PDF: file:///docs/broken.pdf'
    );
  });
});
