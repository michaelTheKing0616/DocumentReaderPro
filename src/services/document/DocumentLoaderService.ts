import { DocumentFormat } from '../../types';
import { ParsedDocument } from './types';
import TxtParser from './parsers/TxtParser';
import DocxParser from './parsers/DocxParser';
import EpubParser from './parsers/EpubParser';
import RtfParser from './parsers/RtfParser';
import ImageParser from './parsers/ImageParser';
import XlsxParser from './parsers/XlsxParser';
import PptxParser from './parsers/PptxParser';
import PdfParser from './parsers/PdfParser';
import DocumentIndexService from './DocumentIndexService';
import { logger } from '../logger/Logger';
import { generateIdSync } from '../../utils/id';

class DocumentLoaderService {
  private cache = new Map<string, ParsedDocument>();

  detectFormat(filename: string, mimeType?: string): DocumentFormat {
    const lower = filename.toLowerCase();
    if (mimeType?.includes('pdf') || lower.endsWith('.pdf')) return 'pdf';
    if (mimeType?.includes('epub') || lower.endsWith('.epub')) return 'epub';
    if (lower.endsWith('.docx') || lower.endsWith('.doc')) return 'docx';
    if (lower.endsWith('.txt') || mimeType?.includes('text/plain')) return 'txt';
    if (lower.endsWith('.rtf')) return 'rtf';
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'xlsx';
    if (lower.endsWith('.pptx') || lower.endsWith('.ppt')) return 'pptx';
    if (/\.(png|jpe?g|gif|bmp|webp)$/.test(lower) || mimeType?.startsWith('image/')) {
      return 'image';
    }
    return 'txt';
  }

  isSupportedFormat(format: string): boolean {
    return ['pdf', 'epub', 'docx', 'txt', 'rtf', 'image', 'xlsx', 'pptx'].includes(format);
  }

  async loadFromUri(uri: string, title?: string): Promise<{
    id: string;
    title: string;
    format: DocumentFormat;
    filePath: string;
  }> {
    const name = uri.split('/').pop() ?? 'document';
    const format = this.detectFormat(name);
    return {
      id: generateIdSync(),
      title: title ?? name,
      format,
      filePath: uri,
    };
  }

  async readTextContent(document: { filePath: string; format: DocumentFormat }): Promise<string> {
    const parsed = await this.load(document.filePath, document.format);
    return parsed.text;
  }

  async load(
    filePath: string,
    format: DocumentFormat,
    options?: { documentId?: string; title?: string; index?: boolean }
  ): Promise<ParsedDocument> {
    const cacheKey = `${format}:${filePath}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    let parsed: ParsedDocument;

    switch (format) {
      case 'txt':
        parsed = await TxtParser.parse(filePath);
        break;
      case 'docx':
        parsed = await DocxParser.parse(filePath);
        break;
      case 'epub':
        parsed = await EpubParser.parse(filePath);
        break;
      case 'rtf':
        parsed = await RtfParser.parse(filePath);
        break;
      case 'image':
        parsed = await ImageParser.parse(filePath);
        break;
      case 'xlsx':
        parsed = await XlsxParser.parse(filePath);
        break;
      case 'pptx':
        parsed = await PptxParser.parse(filePath);
        break;
      case 'pdf':
        parsed = await PdfParser.parse(filePath);
        break;
      default:
        logger.warn('DocumentLoaderService unknown format, falling back to txt', { format });
        parsed = await TxtParser.parse(filePath);
    }

    this.cache.set(cacheKey, parsed);

    if (options?.index && options.documentId && parsed.text) {
      await DocumentIndexService.indexDocument(
        options.documentId,
        options.title ?? filePath.split('/').pop() ?? 'Untitled',
        parsed.text
      );
    }

    return parsed;
  }

  clearCache(filePath?: string): void {
    if (!filePath) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.endsWith(filePath)) {
        this.cache.delete(key);
      }
    }
  }
}

export default new DocumentLoaderService();
