import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { Document, DocumentFormat } from '../../types';
import DataService from '../storage/DataService';
import { generateIdSync } from '../../utils/id';
import { logger } from '../logger/Logger';

class DocumentScannerService {
  // Supported file extensions
  private readonly supportedExtensions = {
    pdf: ['.pdf'],
    epub: ['.epub'],
    docx: ['.docx', '.doc'],
    txt: ['.txt'],
    rtf: ['.rtf'],
    image: ['.jpg', '.jpeg', '.png', '.gif', '.bmp'],
    xlsx: ['.xlsx', '.xls'],
    pptx: ['.pptx', '.ppt'],
  };

  // Scan device for compatible documents
  async scanDeviceForDocuments(): Promise<Document[]> {
    const documents: Document[] = [];

    try {
      // Get common document directories
      const directories = [
        FileSystem.documentDirectory,
        FileSystem.cacheDirectory,
        // Android specific paths
        '/storage/emulated/0/Download',
        '/storage/emulated/0/Documents',
        '/storage/emulated/0/Books',
        // iOS specific paths (if available)
      ].filter(Boolean) as string[];

      for (const directory of directories) {
        try {
          const files = await this.scanDirectory(directory);
          documents.push(...files);
        } catch (error) {
          // Directory might not exist or be accessible, continue
          logger.debug('Could not scan directory', { directory, error: String(error) });
        }
      }

      // Also check Downloads folder specifically
      try {
        const downloads = await this.scanDirectory('/storage/emulated/0/Download');
        documents.push(...downloads);
      } catch (error) {
        console.log('Could not scan Downloads:', error);
      }

      return documents;
    } catch (error) {
      console.error('Error scanning device:', error);
      return [];
    }
  }

  // Scan a specific directory
  private async scanDirectory(directory: string): Promise<Document[]> {
    const documents: Document[] = [];

    try {
      const files = await FileSystem.readDirectoryAsync(directory);

      for (const file of files) {
        const filePath = `${directory}/${file}`;
        const fileInfo = await FileSystem.getInfoAsync(filePath);

        if (fileInfo.exists && !fileInfo.isDirectory) {
          const format = this.detectFormat(file);
          if (format) {
            const document: Document = {
              id: generateIdSync(),
              title: file,
              format,
              filePath,
              uploadDate: new Date(),
            };
            documents.push(document);
          }
        }
      }
    } catch (error) {
      // Directory might not be readable
      console.log(`Error reading directory ${directory}:`, error);
    }

    return documents;
  }

  // Detect document format from filename
  private detectFormat(filename: string): DocumentFormat | null {
    const lowerFilename = filename.toLowerCase();

    for (const [format, extensions] of Object.entries(this.supportedExtensions)) {
      if (extensions.some((ext) => lowerFilename.endsWith(ext))) {
        return format as DocumentFormat;
      }
    }

    return null;
  }

  // Upload document from device
  async uploadDocument(): Promise<Document | null> {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/epub+zip',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
          'text/plain',
          'application/rtf',
          'image/*',
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets[0]) {
        return null;
      }

      const asset = result.assets[0];
      const format = this.detectFormat(asset.name) || 'txt';

      // Copy to app's document directory for persistent storage
      const newPath = `${FileSystem.documentDirectory}${asset.name}`;
      await FileSystem.copyAsync({
        from: asset.uri,
        to: newPath,
      });

      const document: Document = {
        id: generateIdSync(),
        title: asset.name,
        format,
        filePath: newPath,
        uploadDate: new Date(),
      };

      // Save locally (syncs to Supabase when configured)
      await DataService.saveDocument(document);

      return document;
    } catch (error) {
      console.error('Error uploading document:', error);
      return null;
    }
  }

  // Upload multiple documents
  async uploadMultipleDocuments(): Promise<Document[]> {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/epub+zip',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
          'text/plain',
          'application/rtf',
          'image/*',
        ],
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (result.canceled || !result.assets) {
        return [];
      }

      const documents: Document[] = [];

      for (const asset of result.assets) {
        const format = this.detectFormat(asset.name) || 'txt';
        const newPath = `${FileSystem.documentDirectory}${asset.name}`;

        try {
          await FileSystem.copyAsync({
            from: asset.uri,
            to: newPath,
          });

          const document: Document = {
            id: generateIdSync(),
            title: asset.name,
            format,
            filePath: newPath,
            uploadDate: new Date(),
          };

          await DataService.saveDocument(document);
          documents.push(document);
        } catch (error) {
          console.error(`Error processing ${asset.name}:`, error);
        }
      }

      return documents;
    } catch (error) {
      console.error('Error uploading multiple documents:', error);
      return [];
    }
  }

  // Auto-save scanned documents to library
  async autoSaveScannedDocuments(documents: Document[]): Promise<Document[]> {
    const savedDocuments: Document[] = [];

    for (const doc of documents) {
      try {
        // Check if document already exists
        const existingDocs = await DataService.getUserDocuments();
        const exists = existingDocs.some((d) => d.title === doc.title && d.filePath === doc.filePath);

        if (!exists) {
          await DataService.saveDocument(doc);
          savedDocuments.push(doc);
        }
      } catch (error) {
        console.error(`Error saving document ${doc.title}:`, error);
      }
    }

    return savedDocuments;
  }

  // Get file size
  async getFileSize(filePath: string): Promise<number> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      return fileInfo.exists ? (fileInfo.size || 0) : 0;
    } catch (error) {
      return 0;
    }
  }

  // Format file size
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
}

export default new DocumentScannerService();


















