import * as FileSystem from 'expo-file-system';
import JSZip from 'jszip';
import { DocumentParser } from '../types';
import { logger } from '../../logger/Logger';

function extractSlideText(xml: string): string {
  const paragraphs: string[] = [];
  const regex = /<a:t[^>]*>([^<]*)<\/a:t>/g;
  let match = regex.exec(xml);
  while (match) {
    if (match[1]?.trim()) {
      paragraphs.push(match[1].trim());
    }
    match = regex.exec(xml);
  }
  return paragraphs.join('\n');
}

class PptxParser implements DocumentParser {
  async parse(filePath: string) {
    try {
      const base64 = await FileSystem.readAsStringAsync(filePath, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }

      const zip = await JSZip.loadAsync(bytes);
      const slideFiles = Object.keys(zip.files)
        .filter((name) => name.match(/ppt\/slides\/slide\d+\.xml$/))
        .sort((a, b) => {
          const numA = parseInt(a.match(/slide(\d+)/)?.[1] ?? '0', 10);
          const numB = parseInt(b.match(/slide(\d+)/)?.[1] ?? '0', 10);
          return numA - numB;
        });

      const pages = [];
      const toc: { title: string; page: number; level: number }[] = [];

      for (let i = 0; i < slideFiles.length; i += 1) {
        const xml = await zip.file(slideFiles[i])?.async('string');
        const text = xml ? extractSlideText(xml) : '';
        const pageNumber = i + 1;
        pages.push({ pageNumber, text: text || `Slide ${pageNumber}` });
        toc.push({ title: `Slide ${pageNumber}`, page: pageNumber, level: 1 });
      }

      const fullText = pages.map((p) => p.text).join('\n\n');
      return {
        text: fullText,
        pageCount: Math.max(1, pages.length),
        toc,
        pages: pages.length > 0 ? pages : [{ pageNumber: 1, text: '' }],
      };
    } catch (error) {
      logger.error('PptxParser failed', {
        message: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to parse PPTX presentation');
    }
  }
}

export default new PptxParser();
