import * as FileSystem from 'expo-file-system';
import { jsPDF } from 'jspdf';
import mammoth from 'mammoth';
import { DocumentFormat } from '../../types';
import DocumentLoaderService from './DocumentLoaderService';
import { logger } from '../logger/Logger';

export type ConversionTarget = 'pdf' | 'txt' | 'html';

class FormatConverterService {
  private outputDir = `${FileSystem.documentDirectory}converted/`;

  private async ensureDir(): Promise<string> {
    const info = await FileSystem.getInfoAsync(this.outputDir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(this.outputDir, { intermediates: true });
    }
    return this.outputDir;
  }

  async convert(
    filePath: string,
    sourceFormat: DocumentFormat,
    target: ConversionTarget
  ): Promise<string> {
    await this.ensureDir();
    const baseName = filePath.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'document';

    if (target === 'txt') {
      const parsed = await DocumentLoaderService.load(filePath, sourceFormat);
      const outPath = `${this.outputDir}${baseName}.txt`;
      await FileSystem.writeAsStringAsync(outPath, parsed.text);
      return outPath;
    }

    if (target === 'html') {
      if (sourceFormat === 'docx') {
        const buffer = await FileSystem.readAsStringAsync(filePath, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const binary = atob(buffer);
        const arrayBuffer = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          arrayBuffer[i] = binary.charCodeAt(i);
        }
        const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer.buffer });
        const outPath = `${this.outputDir}${baseName}.html`;
        await FileSystem.writeAsStringAsync(outPath, result.value);
        return outPath;
      }
      const parsed = await DocumentLoaderService.load(filePath, sourceFormat);
      const html = `<html><body><pre>${parsed.text.replace(/</g, '&lt;')}</pre></body></html>`;
      const outPath = `${this.outputDir}${baseName}.html`;
      await FileSystem.writeAsStringAsync(outPath, html);
      return outPath;
    }

    if (target === 'pdf') {
      const parsed = await DocumentLoaderService.load(filePath, sourceFormat);
      const doc = new jsPDF();
      const lines = doc.splitTextToSize(parsed.text.slice(0, 50000), 180);
      let y = 20;
      for (const line of lines) {
        if (y > 280) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, 15, y);
        y += 7;
      }
      const outPath = `${this.outputDir}${baseName}.pdf`;
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      await FileSystem.writeAsStringAsync(outPath, pdfBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      logger.info('Format converted to PDF', { sourceFormat, outPath });
      return outPath;
    }

    throw new Error(`Unsupported conversion: ${sourceFormat} → ${target}`);
  }
}

export default new FormatConverterService();
