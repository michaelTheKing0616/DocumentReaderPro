import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';
import { DocumentParser } from '../types';
import { logger } from '../../logger/Logger';

const ROWS_PER_PAGE = 40;

class XlsxParser implements DocumentParser {
  async parse(filePath: string) {
    try {
      const base64 = await FileSystem.readAsStringAsync(filePath, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const workbook = XLSX.read(base64, { type: 'base64' });
      const sheets: string[] = [];
      const toc: { title: string; page: number; level: number }[] = [];

      workbook.SheetNames.forEach((name, index) => {
        const sheet = workbook.Sheets[name];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        sheets.push(`## ${name}\n\n${csv}`);
        toc.push({ title: name, page: index + 1, level: 1 });
      });

      const fullText = sheets.join('\n\n---\n\n');
      const lines = fullText.split('\n');
      const pages = [];
      for (let i = 0; i < lines.length; i += ROWS_PER_PAGE) {
        pages.push({
          pageNumber: Math.floor(i / ROWS_PER_PAGE) + 1,
          text: lines.slice(i, i + ROWS_PER_PAGE).join('\n'),
        });
      }

      return {
        text: fullText,
        pageCount: Math.max(1, pages.length),
        toc,
        pages: pages.length > 0 ? pages : [{ pageNumber: 1, text: fullText }],
      };
    } catch (error) {
      logger.error('XlsxParser failed', {
        message: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to parse XLSX spreadsheet');
    }
  }
}

export default new XlsxParser();
