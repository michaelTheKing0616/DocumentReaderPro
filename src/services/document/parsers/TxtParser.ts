import * as FileSystem from 'expo-file-system';
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

class TxtParser implements DocumentParser {
  async parse(filePath: string): Promise<ParsedDocument> {
    try {
      const text = await FileSystem.readAsStringAsync(filePath, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const normalized = text.replace(/\r\n/g, '\n');
      const pages = splitIntoPages(normalized);

      return {
        text: normalized,
        pageCount: pages.length,
        pages,
      };
    } catch (error) {
      logger.error('TxtParser failed', {
        filePath,
        message: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to parse text file: ${filePath}`);
    }
  }
}

export default new TxtParser();
