import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { ensurePdfJsConfigured } from './pdfjsSetup';
import { loadPdfDocument } from './pdfDocumentLoader';
import { logger } from '../logger/Logger';

const THUMBNAIL_SCALE = 0.35;
const THUMBNAIL_JPEG_QUALITY = 0.72;

class ThumbnailService {
  private cacheDir = `${FileSystem.cacheDirectory}thumbnails/`;
  private memoryCache = new Map<string, string>();

  private cacheKey(documentId: string, pageNumber: number): string {
    return `${documentId}_p${pageNumber}`;
  }

  private cachePath(documentId: string, pageNumber: number): string {
    return `${this.cacheDir}${documentId}_p${pageNumber}.jpg`;
  }

  async ensureCacheDir(): Promise<void> {
    const info = await FileSystem.getInfoAsync(this.cacheDir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(this.cacheDir, { intermediates: true });
    }
  }

  async getThumbnail(
    documentId: string,
    filePath: string,
    pageNumber = 1
  ): Promise<string | undefined> {
    const key = this.cacheKey(documentId, pageNumber);
    const cached = this.memoryCache.get(key);
    if (cached) {
      return cached;
    }

    await this.ensureCacheDir();
    const path = this.cachePath(documentId, pageNumber);
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) {
      this.memoryCache.set(key, path);
      return path;
    }

    if (Platform.OS !== 'web') {
      logger.debug('ThumbnailService: native thumbnail generation deferred', { documentId });
      return undefined;
    }

    try {
      const uri = await this.renderPageThumbnail(filePath, pageNumber, path);
      if (uri) {
        this.memoryCache.set(key, uri);
      }
      return uri;
    } catch (error) {
      logger.warn('ThumbnailService render failed', {
        documentId,
        pageNumber,
        message: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }

  async ensureDocumentThumbnail(
    documentId: string,
    filePath: string,
    format: string
  ): Promise<string | undefined> {
    if (format === 'image') {
      return filePath;
    }
    if (format !== 'pdf') {
      return undefined;
    }
    return this.getThumbnail(documentId, filePath, 1);
  }

  clearCache(documentId?: string): void {
    if (!documentId) {
      this.memoryCache.clear();
      return;
    }
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(documentId)) {
        this.memoryCache.delete(key);
      }
    }
  }

  private async renderPageThumbnail(
    filePath: string,
    pageNumber: number,
    outputPath: string
  ): Promise<string | undefined> {
    await ensurePdfJsConfigured();
    const pdf = await loadPdfDocument(filePath);
    if (pageNumber < 1 || pageNumber > pdf.numPages) {
      return undefined;
    }

    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: THUMBNAIL_SCALE });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext('2d');
    if (!context) {
      return undefined;
    }

    await page.render({ canvasContext: context, viewport }).promise;
    const dataUrl = canvas.toDataURL('image/jpeg', THUMBNAIL_JPEG_QUALITY);
    const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
    await FileSystem.writeAsStringAsync(outputPath, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return outputPath;
  }
}

export default new ThumbnailService();
