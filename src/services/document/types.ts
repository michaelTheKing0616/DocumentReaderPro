export interface TocEntry {
  title: string;
  page?: number;
  level: number;
  href?: string;
}

export interface ParsedPage {
  pageNumber: number;
  text: string;
}

export interface ParsedDocument {
  text: string;
  pageCount: number;
  toc?: TocEntry[];
  pages?: ParsedPage[];
}

export interface DocumentParser {
  parse(filePath: string): Promise<ParsedDocument>;
}
