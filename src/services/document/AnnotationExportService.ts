import * as FileSystem from 'expo-file-system';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Annotation, Document } from '../../types';
import { logger } from '../logger/Logger';

export type AnnotationExportFormat = 'pdf' | 'csv';

export interface AnnotationExportOptions {
  document: Document;
  annotations: Annotation[];
  format: AnnotationExportFormat;
  outputFileName?: string;
}

class AnnotationExportService {
  private outputDir = `${FileSystem.documentDirectory}exports/`;

  async ensureOutputDir(): Promise<string> {
    const info = await FileSystem.getInfoAsync(this.outputDir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(this.outputDir, { intermediates: true });
    }
    return this.outputDir;
  }

  async export(options: AnnotationExportOptions): Promise<string> {
    if (options.format === 'csv') {
      return this.exportCsv(options);
    }
    return this.exportPdf(options);
  }

  async exportCsv(options: AnnotationExportOptions): Promise<string> {
    await this.ensureOutputDir();
    const header = 'id,type,page,x,y,width,height,color,text,timestamp';
    const rows = options.annotations.map((a) =>
      [
        a.id,
        a.type,
        a.page,
        a.x,
        a.y,
        a.width ?? '',
        a.height ?? '',
        a.color ?? '',
        `"${(a.text ?? '').replace(/"/g, '""')}"`,
        new Date(a.timestamp).toISOString(),
      ].join(',')
    );
    const csv = [header, ...rows].join('\n');
    const fileName = options.outputFileName ?? `annotations_${options.document.id}_${Date.now()}.csv`;
    const uri = `${this.outputDir}${fileName}`;
    await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
    logger.info('Annotation CSV export complete', { count: options.annotations.length, uri });
    return uri;
  }

  async exportPdf(options: AnnotationExportOptions): Promise<string> {
    await this.ensureOutputDir();
    const pdf = await PDFDocument.create();
    const font = await docFont(pdf);
    const page = pdf.addPage([612, 792]);
    const { height } = page.getSize();
    let y = height - 50;

    page.drawText(`Annotations: ${options.document.title}`, {
      x: 50,
      y,
      size: 16,
      font,
      color: rgb(0, 0, 0),
    });
    y -= 30;

    for (const ann of options.annotations) {
      if (y < 60) {
        const newPage = pdf.addPage([612, 792]);
        y = newPage.getSize().height - 50;
        newPage.drawText(`Annotations (continued)`, { x: 50, y, size: 12, font });
        y -= 24;
      }
      const line = `p${ann.page} [${ann.type}] ${ann.text ?? ''} @ (${ann.x},${ann.y})`;
      page.drawText(line.slice(0, 90), { x: 50, y, size: 10, font, color: rgb(0.2, 0.2, 0.2) });
      y -= 16;
    }

    const bytes = await pdf.save();
    const fileName = options.outputFileName ?? `annotations_${options.document.id}_${Date.now()}.pdf`;
    const uri = `${this.outputDir}${fileName}`;
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    await FileSystem.writeAsStringAsync(uri, btoa(binary), {
      encoding: FileSystem.EncodingType.Base64,
    });
    logger.info('Annotation PDF export complete', { count: options.annotations.length, uri });
    return uri;
  }
}

async function docFont(pdf: PDFDocument) {
  return pdf.embedFont(StandardFonts.Helvetica);
}

export default new AnnotationExportService();
