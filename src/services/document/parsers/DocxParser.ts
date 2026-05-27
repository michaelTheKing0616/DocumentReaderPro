import mammoth from 'mammoth';
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
class DocxParser implements DocumentParser {
  async parse(filePath: string): Promise<ParsedDocument> {
    try {
      const uri = filePath.startsWith('file://') ? filePath : `file://${filePath}`;
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      const text = result.value.replace(/\r\n/g, '\n').trim();
      const pages = splitIntoPages(text);

      if (result.messages.length > 0) {
        logger.warn('DocxParser mammoth messages', {
          filePath,
          count: result.messages.length,
        });
      }

      return {
        text,
        pageCount: pages.length,
        pages,
      };
    } catch (error) {
      logger.error('DocxParser failed', {
        filePath,
        message: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to parse DOCX file: ${filePath}`);
    }
  }
}

export default new DocxParser();
