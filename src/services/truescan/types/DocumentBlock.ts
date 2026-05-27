// Document structure types for TrueScan

export type BlockType = 
  | 'title'
  | 'heading'
  | 'paragraph'
  | 'table'
  | 'list'
  | 'list-item'
  | 'image'
  | 'header'
  | 'footer'
  | 'caption'
  | 'footnote'
  | 'quote';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DocumentBlock {
  id: string;
  type: BlockType;
  bbox: BoundingBox;
  text?: string;
  confidence: number;
  pageIndex: number;
  readingOrder: number;
  style?: {
    fontSize?: number;
    fontWeight?: 'normal' | 'bold';
    alignment?: 'left' | 'center' | 'right' | 'justify';
    fontFamily?: string;
  };
  children?: DocumentBlock[];
}

export interface TableModel {
  id: string;
  bbox: BoundingBox;
  rows: TableRow[];
  pageIndex: number;
  confidence: number;
}

export interface TableRow {
  cells: TableCell[];
}

export interface TableCell {
  text: string;
  rowSpan?: number;
  colSpan?: number;
  bbox: BoundingBox;
}

export interface PageModel {
  pageIndex: number;
  imageUri: string;
  width: number;
  height: number;
  blocks: DocumentBlock[];
  tables: TableModel[];
  images: ImageBlock[];
}

export interface ImageBlock {
  id: string;
  bbox: BoundingBox;
  imageUri: string;
  caption?: string;
  pageIndex: number;
}

export interface DocumentStructure {
  pages: PageModel[];
  metadata: {
    title?: string;
    author?: string;
    language?: string;
    createdAt: Date;
  };
}

export interface OCRResult {
  text: string;
  confidence: number;
  bbox: BoundingBox;
  words: OCRWord[];
}

export interface OCRWord {
  text: string;
  confidence: number;
  bbox: BoundingBox;
}

export interface LayoutDetectionResult {
  blocks: DocumentBlock[];
  tables: TableModel[];
  images: ImageBlock[];
  confidence: number;
}
















