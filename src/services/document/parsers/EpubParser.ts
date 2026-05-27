import * as FileSystem from 'expo-file-system';
import JSZip from 'jszip';
import { DocumentParser, ParsedDocument, TocEntry } from '../types';
import { logger } from '../../logger/Logger';

const CHARS_PER_PAGE = 3000;

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function resolvePath(baseDir: string, href: string): string {
  if (href.startsWith('/')) {
    return href.slice(1);
  }
  const parts = `${baseDir}/${href}`.split('/');
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === '' || part === '.') {
      continue;
    }
    if (part === '..') {
      resolved.pop();
    } else {
      resolved.push(part);
    }
  }
  return resolved.join('/');
}

function parseContainerRootfile(containerXml: string): string | undefined {
  const match = containerXml.match(/full-path\s*=\s*["']([^"']+)["']/i);
  return match?.[1];
}

function parseOpfSpine(opfContent: string): {
  idrefs: string[];
  manifest: Map<string, string>;
} {
  const manifest = new Map<string, string>();
  const manifestRegex = /<item[^>]+id\s*=\s*["']([^"']+)["'][^>]+href\s*=\s*["']([^"']+)["'][^>]*\/?>/gi;
  let manifestMatch: RegExpExecArray | null;
  while ((manifestMatch = manifestRegex.exec(opfContent)) !== null) {
    manifest.set(manifestMatch[1], manifestMatch[2]);
  }

  const idrefs: string[] = [];
  const itemrefRegex = /<itemref[^>]+idref\s*=\s*["']([^"']+)["'][^>]*\/?>/gi;
  let itemrefMatch: RegExpExecArray | null;
  while ((itemrefMatch = itemrefRegex.exec(opfContent)) !== null) {
    idrefs.push(itemrefMatch[1]);
  }

  return { idrefs, manifest };
}

function parseNavToc(navHtml: string): TocEntry[] {
  const entries: TocEntry[] = [];
  const linkRegex = /<a[^>]+href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(navHtml)) !== null) {
    const title = stripHtml(match[2]);
    if (title) {
      entries.push({ title, level: 1, href: match[1] });
    }
  }
  return entries;
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

async function loadZip(filePath: string): Promise<JSZip> {
  const base64 = await FileSystem.readAsStringAsync(filePath, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return JSZip.loadAsync(base64, { base64: true });
}

class EpubParser implements DocumentParser {
  async parse(filePath: string): Promise<ParsedDocument> {
    try {
      const zip = await loadZip(filePath);

      const containerFile = zip.file('META-INF/container.xml');
      if (!containerFile) {
        throw new Error('EPUB missing META-INF/container.xml');
      }

      const containerXml = await containerFile.async('string');
      const opfPath = parseContainerRootfile(containerXml);
      if (!opfPath) {
        throw new Error('EPUB container.xml missing rootfile');
      }

      const opfFile = zip.file(opfPath);
      if (!opfFile) {
        throw new Error(`EPUB missing OPF file: ${opfPath}`);
      }

      const opfContent = await opfFile.async('string');
      const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/')) : '';
      const { idrefs, manifest } = parseOpfSpine(opfContent);

      let toc: TocEntry[] = [];
      const navItem = [...manifest.entries()].find(
        ([, href]) => href.includes('nav') && (href.endsWith('.xhtml') || href.endsWith('.html'))
      );
      if (navItem) {
        const navPath = resolvePath(opfDir, navItem[1]);
        const navFile = zip.file(navPath);
        if (navFile) {
          const navHtml = await navFile.async('string');
          toc = parseNavToc(navHtml);
        }
      }

      const pageTexts: string[] = [];
      for (const idref of idrefs) {
        const href = manifest.get(idref);
        if (!href) {
          continue;
        }
        const contentPath = resolvePath(opfDir, href);
        const contentFile = zip.file(contentPath);
        if (!contentFile) {
          continue;
        }
        const html = await contentFile.async('string');
        pageTexts.push(stripHtml(html));
      }

      const text = pageTexts.filter(Boolean).join('\n\n');
      const pages = pageTexts.map((pageText, index) => ({
        pageNumber: index + 1,
        text: pageText,
      }));

      const normalizedPages = pages.length > 0 ? pages : splitIntoPages(text);

      if (toc.length > 0) {
        toc = toc.map((entry, index) => ({
          ...entry,
          page: Math.min(index + 1, normalizedPages.length),
        }));
      }

      return {
        text,
        pageCount: normalizedPages.length,
        toc,
        pages: normalizedPages,
      };
    } catch (error) {
      logger.error('EpubParser failed', {
        filePath,
        message: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to parse EPUB file: ${filePath}`);
    }
  }
}

export default new EpubParser();
