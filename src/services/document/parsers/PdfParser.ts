import { DocumentParser, ParsedDocument } from '../types';
import { loadPdfDocument } from '../pdfDocumentLoader';
import { logger } from '../../logger/Logger';

class PdfParser implements DocumentParser {
  async parse(filePath: string): Promise<ParsedDocument> {
    try {
      const pdf = await loadPdfDocument(filePath);
      const pageCount = pdf.numPages;
      const pages: NonNullable<ParsedDocument['pages']> = [];
      const textParts: string[] = [];

      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

        pages.push({ pageNumber, text: pageText });
        if (pageText.length > 0) {
          textParts.push(pageText);
        }
      }

      return {
        text: textParts.join('\n\n'),
        pageCount,
        pages,
      };
    } catch (error) {
      logger.error('PdfParser failed', {
        filePath,
        message: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to parse PDF: ${filePath}`);
    }
  }
}

export default new PdfParser();
