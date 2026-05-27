import LocalDatabaseService from '../storage/local/LocalDatabaseService';
import DataService from '../storage/DataService';
import { DocumentSearchResult } from '../storage/types';
import { logger } from '../logger/Logger';

class DocumentIndexService {
  async indexDocument(documentId: string, title: string, content: string): Promise<void> {
    const userId = await this.getUserId();
    await LocalDatabaseService.indexDocumentText(documentId, userId, title, content);
    logger.info('Document indexed for search', { documentId, titleLength: title.length });
  }

  async search(query: string, limit = 20): Promise<DocumentSearchResult[]> {
    if (!query.trim()) {
      return [];
    }
    const userId = await this.getUserId();
    return LocalDatabaseService.searchDocuments(query.trim(), userId, limit);
  }

  async removeDocumentIndex(documentId: string): Promise<void> {
    await LocalDatabaseService.removeDocumentIndex(documentId);
  }

  private async getUserId(): Promise<string> {
    const session = DataService.getCurrentUser();
    if (session) {
      return session.id;
    }
    return LocalDatabaseService.getLocalUserId();
  }
}

export default new DocumentIndexService();
