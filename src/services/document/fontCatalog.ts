/** Catalog label for the bundled OpenDyslexic face (loaded as OpenDyslexic-Regular). */
export const OPEN_DYSLEXIC_CATALOG_LABEL = 'OpenDyslexic' as const;

export const READER_FONT_CATALOG = [
  'System',
  OPEN_DYSLEXIC_CATALOG_LABEL,
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Georgia',
  'Verdana',
  'Tahoma',
  'Courier New',
  'Palatino',
  'Garamond',
  'Comic Sans MS',
  'Trebuchet MS',
  'Lucida Sans',
  'Century Gothic',
  'Book Antiqua',
  'Franklin Gothic',
  'Segoe UI',
  'Roboto',
  'Noto Sans',
  'Merriweather',
  'Lato',
  'Source Sans Pro',
] as const;

export type ReaderFont = (typeof READER_FONT_CATALOG)[number];
