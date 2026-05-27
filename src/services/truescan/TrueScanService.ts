import { DocumentStructure, PageModel } from './types/DocumentBlock';
import CameraCaptureService from './camera/capture';
import ImagePreprocessingService from './camera/preprocessing';
import LayoutDetectionService from './vision/layoutDetection';
import TableDetectionService from './vision/tableDetection';
import OCRService from './ocr/ocrService';
import StructureBuilderService from './reconstruction/structureBuilder';
import DOCXExporterService from './export/docxExporter';
import PDFExporterService from './export/pdfExporter';
import HTMLExporterService from './export/htmlExporter';
import { CapturedPage } from './camera/capture';
import * as FileSystem from 'expo-file-system';

export type ExportFormat = 'docx' | 'pdf' | 'html';

export interface TrueScanOptions {
  autoPreprocess?: boolean;
  language?: string;
  exportFormat?: ExportFormat;
}

export interface TrueScanResult {
  document: DocumentStructure;
  exportedPath: string;
  processingTime: number;
}

class TrueScanService {
  // Main pipeline: Camera → Perfect Document
  async processDocument(
    pages: CapturedPage[],
    options: TrueScanOptions = {}
  ): Promise<TrueScanResult> {
    const startTime = Date.now();

    try {
      // Step 1: Preprocess images
      const preprocessedPages = options.autoPreprocess !== false
        ? await ImagePreprocessingService.preprocessImages(
            pages.map((p) => p.uri)
          )
        : pages.map((p) => ({
            processedUri: p.uri,
            width: p.width,
            height: p.height,
          }));

      // Step 2: Detect layout from OCR bounding boxes (column-aware)
      const layoutResults = await Promise.all(
        preprocessedPages.map((page, pageIndex) =>
          LayoutDetectionService.detectLayout(
            page.processedUri,
            page.width,
            page.height,
            pageIndex
          )
        )
      );

      // Step 3: Detect tables
      const tableResults = await Promise.all(
        preprocessedPages.map((page, index) =>
          LayoutDetectionService.detectTables(
            page.processedUri,
            page.width,
            page.height
          )
        )
      );

      // Step 4: Reuse OCR text from layout blocks; OCR only blocks missing text
      const ocrResults = await Promise.all(
        preprocessedPages.map(async (page, pageIndex) => {
          const blocks = layoutResults[pageIndex].blocks;
          const results = await Promise.all(
            blocks.map(async (block) => {
              if (block.text && block.text.trim().length > 0) {
                return {
                  text: block.text,
                  confidence: block.confidence * 100,
                  bbox: block.bbox,
                  words: [],
                };
              }
              return OCRService.recognizeText(
                page.processedUri,
                block.bbox,
                options.language,
                { preprocess: true, psm: 'block' }
              );
            })
          );
          return results;
        })
      );

      // Step 5: Process tables
      const processedTables = await Promise.all(
        tableResults.map(async (tables, pageIndex) => {
          const processed = [];
          for (const table of tables) {
            // Detect table structure and OCR cells
            const tableModel = await TableDetectionService.detectTable(
              preprocessedPages[pageIndex].processedUri,
              table.bbox
            );
            if (tableModel) {
              processed.push(tableModel);
            }
          }
          return processed;
        })
      );

      // Step 6: Build document structure
      const structureData = preprocessedPages.map((page, index) => ({
        imageUri: page.processedUri,
        width: page.width,
        height: page.height,
        blocks: layoutResults[index].blocks,
        ocrResults: ocrResults[index],
        tables: processedTables[index],
        images: layoutResults[index].images,
      }));

      let structure = StructureBuilderService.buildStructure(structureData);

      // Step 7: Semantic reconstruction
      structure.pages = structure.pages.map((page) => ({
        ...page,
        blocks: StructureBuilderService.establishReadingOrder(
          StructureBuilderService.mergeParagraphs(
            StructureBuilderService.inferHeadingLevels(
              StructureBuilderService.detectLists(page.blocks)
            )
          )
        ),
      }));

      // Step 8: Export to requested format
      const format = options.exportFormat || 'pdf';
      const fileName = `truescan_${Date.now()}.${format}`;
      const outputPath = `${FileSystem.documentDirectory}${fileName}`;

      let exportedPath: string;

      switch (format) {
        case 'docx':
          exportedPath = await DOCXExporterService.exportToDOCX(
            structure,
            outputPath
          );
          break;
        case 'html':
          exportedPath = await HTMLExporterService.exportToHTML(
            structure,
            outputPath
          );
          break;
        case 'pdf':
        default:
          exportedPath = await PDFExporterService.exportToPDF(
            structure,
            outputPath
          );
          break;
      }

      const processingTime = Date.now() - startTime;

      return {
        document: structure,
        exportedPath,
        processingTime,
      };
    } catch (error) {
      console.error('TrueScan processing error:', error);
      throw error;
    }
  }

  // Quick scan (single page)
  async quickScan(
    imageUri: string,
    options: TrueScanOptions = {}
  ): Promise<TrueScanResult> {
    const { Image } = require('react-native');
    return new Promise((resolve, reject) => {
      Image.getSize(
        imageUri,
        (width: number, height: number) => {
          const page: CapturedPage = {
            uri: imageUri,
            width,
            height,
            timestamp: Date.now(),
            pageIndex: 0,
          };
          this.processDocument([page], options).then(resolve).catch(reject);
        },
        reject
      );
    });
  }

  // Get camera capture service
  getCameraService() {
    return CameraCaptureService;
  }
}

export default new TrueScanService();

