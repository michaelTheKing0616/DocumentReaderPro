import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
} from 'docx';
import * as FileSystem from 'expo-file-system';
import { DocumentStructure, DocumentBlock } from '../types/DocumentBlock';
import { logger } from '../../logger/Logger';

function headingLevel(block: DocumentBlock): (typeof HeadingLevel)[keyof typeof HeadingLevel] {
  if (block.type === 'title') {
    return HeadingLevel.TITLE;
  }
  if (block.style?.fontSize && block.style.fontSize >= 20) {
    return HeadingLevel.HEADING_1;
  }
  return HeadingLevel.HEADING_2;
}

function blockToParagraphs(block: DocumentBlock): Paragraph[] {
  switch (block.type) {
    case 'title':
    case 'heading':
      return [
        new Paragraph({
          heading: headingLevel(block),
          children: [new TextRun({ text: block.text ?? '', bold: block.style?.fontWeight === 'bold' })],
          alignment:
            block.style?.alignment === 'center'
              ? AlignmentType.CENTER
              : block.style?.alignment === 'right'
                ? AlignmentType.RIGHT
                : AlignmentType.LEFT,
        }),
      ];
    case 'list':
      return (block.children ?? []).flatMap((item) =>
        blockToParagraphs({ ...item, type: 'list-item' })
      );
    case 'list-item':
      return [
        new Paragraph({
          text: block.text ?? '',
          bullet: { level: 0 },
        }),
      ];
    case 'quote':
      return [
        new Paragraph({
          children: [new TextRun({ text: block.text ?? '', italics: true })],
          indent: { left: 720 },
        }),
      ];
    case 'table':
      if (!block.children?.length) {
        return [new Paragraph({ children: [new TextRun({ text: block.text ?? '[Table]' })] })];
      }
      return [
        new Paragraph({
          children: [
            new TextRun({
              text: block.children.map((row) => row.text ?? '').filter(Boolean).join(' | '),
            }),
          ],
        }),
      ];
    default:
      return [
        new Paragraph({
          children: [new TextRun({ text: block.text ?? '' })],
          spacing: { after: 200 },
        }),
      ];
  }
}

function tableFromPage(table: { rows?: { cells: { text: string }[] }[] }): Table | null {
  const rows = table.rows ?? [];
  if (rows.length === 0) {
    return null;
  }
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      (row) =>
        new TableRow({
          children: row.cells.map(
            (cell) =>
              new TableCell({
                children: [new Paragraph({ children: [new TextRun(cell.text)] })],
              })
          ),
        })
    ),
  });
}

class DOCXExporterService {
  /** Export document structure to a real .docx file (Office Open XML). */
  async exportToDOCX(structure: DocumentStructure, outputPath: string): Promise<string> {
    const docxPath = outputPath.endsWith('.docx') ? outputPath : `${outputPath.replace(/\.\w+$/, '')}.docx`;

    const children: (Paragraph | Table)[] = [];

    if (structure.metadata.title) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.TITLE,
          children: [new TextRun({ text: structure.metadata.title, bold: true })],
        })
      );
    }

    if (structure.metadata.author) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `By ${structure.metadata.author}`, italics: true })],
          spacing: { after: 300 },
        })
      );
    }

    for (const page of structure.pages) {
      for (const block of page.blocks) {
        children.push(...blockToParagraphs(block));
      }
      for (const table of page.tables ?? []) {
        const docxTable = tableFromPage(table);
        if (docxTable) {
          children.push(docxTable);
          children.push(new Paragraph({ text: '' }));
        }
      }
    }

    const doc = new Document({
      sections: [{ properties: {}, children }],
    });

    const base64 = await Packer.toBase64String(doc);
    await FileSystem.writeAsStringAsync(docxPath, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    logger.info('DOCX export complete', { path: docxPath, blocks: children.length });
    return docxPath;
  }

  async generateDOCX(structure: DocumentStructure): Promise<ArrayBuffer> {
    const children: Paragraph[] = [];
    for (const page of structure.pages) {
      for (const block of page.blocks) {
        children.push(...blockToParagraphs(block));
      }
    }
    const doc = new Document({ sections: [{ properties: {}, children }] });
    return Packer.toBuffer(doc);
  }
}

export default new DOCXExporterService();
