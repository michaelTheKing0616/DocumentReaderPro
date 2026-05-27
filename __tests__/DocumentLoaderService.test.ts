import DocumentLoaderService from '../src/services/document/DocumentLoaderService';

jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true }),
  readAsStringAsync: jest.fn().mockResolvedValue('Hello world'),
  EncodingType: { UTF8: 'utf8', Base64: 'base64' },
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  randomUUID: () => 'test-uuid-1234',
}));

describe('DocumentLoaderService', () => {
  it('detects format from file extension', () => {
    expect(DocumentLoaderService.detectFormat('report.pdf')).toBe('pdf');
    expect(DocumentLoaderService.detectFormat('book.epub')).toBe('epub');
    expect(DocumentLoaderService.detectFormat('notes.txt')).toBe('txt');
    expect(DocumentLoaderService.detectFormat('scan.png')).toBe('image');
  });

  it('detects format from MIME type', () => {
    expect(DocumentLoaderService.detectFormat('file', 'application/pdf')).toBe('pdf');
    expect(DocumentLoaderService.detectFormat('file', 'text/plain')).toBe('txt');
  });

  it('loads document from URI', async () => {
    const doc = await DocumentLoaderService.loadFromUri('file:///docs/test.pdf', 'My Report');
    expect(doc.title).toBe('My Report');
    expect(doc.format).toBe('pdf');
    expect(doc.filePath).toContain('test.pdf');
    expect(doc.id).toBeTruthy();
  });

  it('reads text content for txt documents', async () => {
    const doc = await DocumentLoaderService.loadFromUri('file:///docs/notes.txt');
    const text = await DocumentLoaderService.readTextContent(doc);
    expect(text).toBe('Hello world');
  });

  it('reports supported formats', () => {
    expect(DocumentLoaderService.isSupportedFormat('pdf')).toBe(true);
    expect(DocumentLoaderService.isSupportedFormat('txt')).toBe(true);
  });
});
