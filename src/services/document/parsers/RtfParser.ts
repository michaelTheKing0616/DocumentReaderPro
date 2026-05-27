import * as FileSystem from 'expo-file-system';
import { DocumentParser, ParsedDocument } from '../types';
import { logger } from '../../logger/Logger';

const CHARS_PER_PAGE = 3000;

/** Strip common RTF control words and groups, leaving plain text. */
export function stripRtfTags(rtf: string): string {
  let text = rtf;

  // Remove RTF header and font/color tables (nested groups).
  text = text.replace(/\{\\\*\\[a-z]+[^}]*\}/gi, '');
  text = text.replace(/\{\\fonttbl[^}]*\}/gi, '');
  text = text.replace(/\{\\colortbl[^}]*\}/gi, '');
  text = text.replace(/\{\\stylesheet[^}]*\}/gi, '');

  // Convert paragraph and line breaks.
  text = text.replace(/\\par[d]?/gi, '\n');
  text = text.replace(/\\line/gi, '\n');
  text = text.replace(/\\tab/gi, '\t');

  // Remove remaining control words like \b, \i1, \fs24.
  text = text.replace(/\\[a-z]+\d*(?:\s|$)/gi, '');

  // Remove hex-encoded characters \'xx.
  text = text.replace(/\\'[0-9a-f]{2}/gi, '');

  // Remove escaped braces and backslashes.
  text = text.replace(/\\([{}\\])/g, '$1');

  // Remove remaining brace groups (best-effort).
  text = text.replace(/[{}]/g, '');

  return text.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n').trim();
}

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

class RtfParser implements DocumentParser {
  async parse(filePath: string): Promise<ParsedDocument> {
    try {
      const raw = await FileSystem.readAsStringAsync(filePath, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const text = stripRtfTags(raw);
      const pages = splitIntoPages(text);

      return {
        text,
        pageCount: pages.length,
        pages,
      };
    } catch (error) {
      logger.error('RtfParser failed', {
        filePath,
        message: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to parse RTF file: ${filePath}`);
    }
  }
}

export default new RtfParser();
