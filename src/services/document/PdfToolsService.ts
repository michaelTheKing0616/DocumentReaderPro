import * as FileSystem from 'expo-file-system';
import { PDFDocument, PDFForm, PDFTextField, rgb, StandardFonts, degrees } from 'pdf-lib';
import { logger } from '../logger/Logger';

export interface PdfMergeOptions {
  sourceUris: string[];
  outputFileName?: string;
}

export interface PdfSplitOptions {
  sourceUri: string;
  pageRanges: { start: number; end: number; label?: string }[];
  outputDir?: string;
}

export interface PdfCompressOptions {
  sourceUri: string;
  /** 0-1 quality hint; lower = smaller file */
  quality?: number;
  outputFileName?: string;
}

export type PdfRotation = 90 | 180 | 270;

export interface PdfRotateOptions {
  sourceUri: string;
  /** Page indices to rotate (0-based). Empty = all pages. */
  pageIndices?: number[];
  degrees: PdfRotation;
  outputFileName?: string;
}

export interface PdfFormField {
  name: string;
  value: string;
  type?: 'text' | 'checkbox';
}

export interface ESignatureField {
  name: string;
  signerName: string;
  signedAt?: string;
  /** Base64 PNG signature image */
  signatureImageBase64?: string;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

class PdfToolsService {
  private outputDir = `${FileSystem.documentDirectory}pdf-tools/`;

  async ensureOutputDir(): Promise<string> {
    const info = await FileSystem.getInfoAsync(this.outputDir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(this.outputDir, { intermediates: true });
    }
    return this.outputDir;
  }

  private async readPdfBytes(uri: string): Promise<Uint8Array> {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  private async writePdfBytes(bytes: Uint8Array, fileName: string): Promise<string> {
    await this.ensureOutputDir();
    const uri = `${this.outputDir}${fileName}`;
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    await FileSystem.writeAsStringAsync(uri, btoa(binary), {
      encoding: FileSystem.EncodingType.Base64,
    });
    return uri;
  }

  async mergePdfs(options: PdfMergeOptions): Promise<string> {
    const merged = await PDFDocument.create();
    for (const uri of options.sourceUris) {
      const bytes = await this.readPdfBytes(uri);
      const doc = await PDFDocument.load(bytes);
      const pages = await merged.copyPages(doc, doc.getPageIndices());
      pages.forEach((page) => merged.addPage(page));
    }
    const outBytes = await merged.save();
    const fileName = options.outputFileName ?? `merged_${Date.now()}.pdf`;
    const outUri = await this.writePdfBytes(outBytes, fileName);
    logger.info('PDF merge complete', { sources: options.sourceUris.length, outUri });
    return outUri;
  }

  async splitPdf(options: PdfSplitOptions): Promise<string[]> {
    const bytes = await this.readPdfBytes(options.sourceUri);
    const source = await PDFDocument.load(bytes);
    const outDir = options.outputDir ?? (await this.ensureOutputDir());
    const results: string[] = [];

    for (let i = 0; i < options.pageRanges.length; i += 1) {
      const range = options.pageRanges[i];
      const part = await PDFDocument.create();
      const indices: number[] = [];
      for (let p = range.start; p <= range.end; p += 1) {
        if (p >= 0 && p < source.getPageCount()) {
          indices.push(p);
        }
      }
      const pages = await part.copyPages(source, indices);
      pages.forEach((page) => part.addPage(page));
      const partBytes = await part.save();
      const label = range.label ?? `part_${i + 1}`;
      const uri = `${outDir}${label}_${Date.now()}.pdf`;
      let binary = '';
      for (let b = 0; b < partBytes.length; b += 1) {
        binary += String.fromCharCode(partBytes[b]);
      }
      await FileSystem.writeAsStringAsync(uri, btoa(binary), {
        encoding: FileSystem.EncodingType.Base64,
      });
      results.push(uri);
    }

    logger.info('PDF split complete', { parts: results.length });
    return results;
  }

  async compressPdf(options: PdfCompressOptions): Promise<string> {
    const bytes = await this.readPdfBytes(options.sourceUri);
    const doc = await PDFDocument.load(bytes);
    // pdf-lib re-save strips unused objects; quality param reserved for future image recompression
    const quality = options.quality ?? 0.7;
    const outBytes = await doc.save({ useObjectStreams: quality < 0.5 });
    const fileName = options.outputFileName ?? `compressed_${Date.now()}.pdf`;
    const outUri = await this.writePdfBytes(outBytes, fileName);
    logger.info('PDF compress complete', { quality, outUri });
    return outUri;
  }

  async fillForm(sourceUri: string, fields: PdfFormField[]): Promise<string> {
    const bytes = await this.readPdfBytes(sourceUri);
    const doc = await PDFDocument.load(bytes);
    const form: PDFForm = doc.getForm();

    for (const field of fields) {
      try {
        if (field.type === 'checkbox') {
          const cb = form.getCheckBox(field.name);
          if (field.value === 'true' || field.value === '1') {
            cb.check();
          } else {
            cb.uncheck();
          }
        } else {
          const tf: PDFTextField = form.getTextField(field.name);
          tf.setText(field.value);
        }
      } catch (error) {
        logger.warn('Form field not found, skipping', {
          name: field.name,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    form.flatten();
    const outBytes = await doc.save();
    return this.writePdfBytes(outBytes, `filled_${Date.now()}.pdf`);
  }

  /** Scaffold: embed signature placeholders / images on PDF pages. */
  async applyESignatures(sourceUri: string, signatures: ESignatureField[]): Promise<string> {
    const bytes = await this.readPdfBytes(sourceUri);
    const doc = await PDFDocument.load(bytes);
    const font = await doc.embedFont(StandardFonts.Helvetica);

    for (const sig of signatures) {
      const page = doc.getPage(sig.pageIndex);
      if (!page) {
        continue;
      }
      const signedAt = sig.signedAt ?? new Date().toISOString();
      page.drawText(`${sig.signerName} — ${signedAt}`, {
        x: sig.x,
        y: sig.y,
        size: 10,
        font,
        color: rgb(0.1, 0.1, 0.5),
      });
      page.drawRectangle({
        x: sig.x,
        y: sig.y - sig.height,
        width: sig.width,
        height: sig.height,
        borderColor: rgb(0.2, 0.4, 0.8),
        borderWidth: 1,
      });
      if (sig.signatureImageBase64) {
        try {
          const raw = sig.signatureImageBase64.replace(/^data:image\/\w+;base64,/, '');
          const binary = Uint8Array.from(atob(raw), (char) => char.charCodeAt(0));
          let image;
          try {
            image = await doc.embedPng(binary);
          } catch {
            image = await doc.embedJpg(binary);
          }
          page.drawImage(image, {
            x: sig.x,
            y: sig.y - sig.height,
            width: sig.width,
            height: sig.height,
          });
        } catch (error) {
          logger.warn('Signature image embed failed; using text fallback', {
            name: sig.name,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    const outBytes = await doc.save();
    return this.writePdfBytes(outBytes, `signed_${Date.now()}.pdf`);
  }

  async rotatePdf(options: PdfRotateOptions): Promise<string> {
    const bytes = await this.readPdfBytes(options.sourceUri);
    const doc = await PDFDocument.load(bytes);
    const pageCount = doc.getPageCount();
    const indices =
      options.pageIndices && options.pageIndices.length > 0
        ? options.pageIndices
        : Array.from({ length: pageCount }, (_, i) => i);

    for (const index of indices) {
      const page = doc.getPage(index);
      if (!page) {
        continue;
      }
      const current = page.getRotation().angle;
      page.setRotation(degrees((current + options.degrees) % 360));
    }

    const outBytes = await doc.save();
    const fileName = options.outputFileName ?? `rotated_${Date.now()}.pdf`;
    const outUri = await this.writePdfBytes(outBytes, fileName);
    logger.info('PDF rotate complete', { degrees: options.degrees, pages: indices.length, outUri });
    return outUri;
  }

  async getPageCount(uri: string): Promise<number> {
    const bytes = await this.readPdfBytes(uri);
    const doc = await PDFDocument.load(bytes);
    return doc.getPageCount();
  }

  /**
   * Password-protect a PDF. Requires pdf-lib encryption support on target platform.
   * Falls back to copying bytes when encryption is unavailable.
   */
  async encryptPdf(
    sourceUri: string,
    userPassword: string,
    ownerPassword?: string
  ): Promise<string> {
    const bytes = await this.readPdfBytes(sourceUri);
    const doc = await PDFDocument.load(bytes);

    const saveOptions: Record<string, unknown> = {};
    if (typeof (doc as unknown as { encrypt?: Function }).encrypt === 'function') {
      (doc as unknown as { encrypt: (u: string, o: string) => void }).encrypt(
        userPassword,
        ownerPassword ?? userPassword
      );
    } else {
      logger.warn(
        'PDF encryption not available in this pdf-lib build — saving unencrypted copy'
      );
    }

    const outBytes = await doc.save(saveOptions);
    return this.writePdfBytes(outBytes, `protected_${Date.now()}.pdf`);
  }
}

export default new PdfToolsService();
