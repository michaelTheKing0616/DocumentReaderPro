import LocalDatabaseService from './local/LocalDatabaseService';
import SupabaseRepository from './supabase/SupabaseRepository';
import SyncEngine from './sync/SyncEngine';
import { isSyncEnabled } from './supabase/SupabaseClient';
import {
  Bookmark,
  DocumentSearchResult,
  Folder,
  SessionUser,
  StoredAnnotation,
  SyncEntityType,
  SyncOperation,
} from './types';
import { Document, ReadingMetrics, UserProfile } from '../../types';
import { logger } from '../logger/Logger';

/**
 * Local-first data facade. SQLite is source of truth; Supabase syncs when configured.
 */
class DataService {
  private session: SessionUser | null = null;

  async initialize(): Promise<void> {
    await LocalDatabaseService.initialize();
    const remoteSession = await SupabaseRepository.getSession();
    if (remoteSession) {
      this.session = remoteSession;
      logger.info('DataService using Supabase session', { userId: remoteSession.id });
    } else {
      const localId = await LocalDatabaseService.getLocalUserId();
      this.session = { id: localId, isLocalOnly: true };
      logger.info('DataService using local-only session', { userId: localId });
    }
    await SyncEngine.syncIfPossible(this.session);
  }

  private async getActiveUserId(): Promise<string> {
    if (this.session) {
      return this.session.id;
    }
    return LocalDatabaseService.getLocalUserId();
  }

  private async enqueueCloudSync(
    entityType: SyncEntityType,
    entityId: string,
    operation: SyncOperation,
    payload: unknown
  ): Promise<void> {
    if (!this.session || this.session.isLocalOnly || !SupabaseRepository.isConfigured() || !isSyncEnabled()) {
      return;
    }
    await LocalDatabaseService.enqueueSync({
      entityType,
      entityId,
      operation,
      payload: JSON.stringify(payload),
    });
    await SyncEngine.syncIfPossible(this.session);
  }

  // --- Auth (Supabase when configured; local session always available) ---

  async signIn(email: string, password: string): Promise<SessionUser> {
    const user = await SupabaseRepository.signIn(email, password);
    this.session = user;
    await SyncEngine.syncIfPossible(this.session);
    return user;
  }

  async signUp(email: string, password: string): Promise<SessionUser> {
    const user = await SupabaseRepository.signUp(email, password);
    this.session = user;
    return user;
  }

  async signOut(): Promise<void> {
    await SupabaseRepository.signOut();
    const localId = await LocalDatabaseService.getLocalUserId();
    this.session = { id: localId, isLocalOnly: true };
  }

  getCurrentUser(): SessionUser | null {
    return this.session;
  }

  // --- Profiles ---

  async saveUserProfile(profile: UserProfile): Promise<void> {
    const userId = await this.getActiveUserId();
    const profileToSave: UserProfile = {
      ...profile,
      id: this.session?.isLocalOnly === false ? this.session.id : userId,
      updatedAt: new Date(),
    };
    await LocalDatabaseService.saveUserProfile(profileToSave);
    await this.enqueueCloudSync('profile', profileToSave.id, 'update', profileToSave);
  }

  async getUserProfile(): Promise<UserProfile | null> {
    const userId = await this.getActiveUserId();
    return LocalDatabaseService.getUserProfile(userId);
  }

  // --- Documents ---

  async saveDocument(document: Document): Promise<string> {
    const userId = await this.getActiveUserId();
    await LocalDatabaseService.saveDocument(document, userId);
    await this.enqueueCloudSync('document', document.id, 'insert', document);
    return document.id;
  }

  async getUserDocuments(): Promise<Document[]> {
    const userId = await this.getActiveUserId();
    return LocalDatabaseService.getDocuments(userId);
  }

  // --- Reading metrics ---

  async saveReadingMetrics(metrics: ReadingMetrics): Promise<void> {
    const userId = await this.getActiveUserId();
    await LocalDatabaseService.saveReadingMetrics(metrics, userId);
    const metricId = `${metrics.documentId}-${metrics.pageNumber}-${metrics.timestamp}`;
    await this.enqueueCloudSync('reading_metrics', metricId, 'insert', metrics);
  }

  async getReadingMetrics(documentId?: string): Promise<ReadingMetrics[]> {
    const userId = await this.getActiveUserId();
    const local = await LocalDatabaseService.getReadingMetrics(userId, documentId);
    if (this.session && !this.session.isLocalOnly && SupabaseRepository.isConfigured()) {
      try {
        const remote = await SupabaseRepository.pullReadingMetrics(userId, documentId);
        if (remote.length > local.length) {
          return remote;
        }
      } catch (error) {
        logger.warn('Falling back to local metrics', {
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return local;
  }

  // --- Storage ---

  async uploadFile(localUri: string, path: string): Promise<string> {
    if (!SupabaseRepository.isConfigured() || this.session?.isLocalOnly) {
      return localUri;
    }
    return SupabaseRepository.uploadFile(localUri, path);
  }

  /** Trigger manual sync (e.g. when network returns). */
  async syncNow(): Promise<void> {
    await SyncEngine.syncIfPossible(this.session);
  }

  // --- Folders ---

  async saveFolder(folder: Folder): Promise<void> {
    const userId = await this.getActiveUserId();
    await LocalDatabaseService.saveFolder(folder, userId);
    await this.enqueueCloudSync('folder', folder.id, 'update', folder);
  }

  async getFolders(): Promise<Folder[]> {
    const userId = await this.getActiveUserId();
    return LocalDatabaseService.getFolders(userId);
  }

  async deleteFolder(folderId: string): Promise<void> {
    const userId = await this.getActiveUserId();
    await LocalDatabaseService.deleteFolder(folderId, userId);
    await this.enqueueCloudSync('folder', folderId, 'delete', { id: folderId });
  }

  // --- Bookmarks ---

  async saveBookmark(bookmark: Bookmark): Promise<void> {
    const userId = await this.getActiveUserId();
    await LocalDatabaseService.saveBookmark(bookmark, userId);
    await this.enqueueCloudSync('bookmark', bookmark.id, 'update', bookmark);
  }

  async getBookmarks(documentId?: string): Promise<Bookmark[]> {
    const userId = await this.getActiveUserId();
    return LocalDatabaseService.getBookmarks(userId, documentId);
  }

  async deleteBookmark(bookmarkId: string): Promise<void> {
    const userId = await this.getActiveUserId();
    await LocalDatabaseService.deleteBookmark(bookmarkId, userId);
    await this.enqueueCloudSync('bookmark', bookmarkId, 'delete', { id: bookmarkId });
  }

  // --- Annotations ---

  async saveAnnotation(annotation: StoredAnnotation): Promise<void> {
    const userId = await this.getActiveUserId();
    await LocalDatabaseService.saveAnnotation(annotation, userId);
    await this.enqueueCloudSync('annotation', annotation.id, 'update', annotation);
  }

  async getAnnotations(documentId?: string): Promise<StoredAnnotation[]> {
    const userId = await this.getActiveUserId();
    return LocalDatabaseService.getAnnotations(userId, documentId);
  }

  async deleteAnnotation(annotationId: string): Promise<void> {
    const userId = await this.getActiveUserId();
    await LocalDatabaseService.deleteAnnotation(annotationId, userId);
    await this.enqueueCloudSync('annotation', annotationId, 'delete', { id: annotationId });
  }

  // --- Full-text search ---

  async indexDocumentText(documentId: string, title: string, content: string): Promise<void> {
    const userId = await this.getActiveUserId();
    await LocalDatabaseService.indexDocumentText(documentId, userId, title, content);
  }

  async searchDocuments(query: string, limit = 20): Promise<DocumentSearchResult[]> {
    const userId = await this.getActiveUserId();
    return LocalDatabaseService.searchDocuments(query, userId, limit);
  }

  /**
   * Migrates local-only data to the authenticated cloud user after sign-in.
   */
  async mergeLocalDataToCloud(): Promise<void> {
    if (!this.session || this.session.isLocalOnly || !SupabaseRepository.isConfigured()) {
      return;
    }

    const localUserId = await LocalDatabaseService.getLocalUserId();
    const cloudUserId = this.session.id;

    if (localUserId === cloudUserId) {
      return;
    }

    logger.info('Merging local data to cloud', { localUserId, cloudUserId });

    const profile = await LocalDatabaseService.getUserProfile(localUserId);
    if (profile) {
      const migratedProfile: UserProfile = { ...profile, id: cloudUserId, updatedAt: new Date() };
      await LocalDatabaseService.saveUserProfile(migratedProfile);
      await SupabaseRepository.upsertProfile(migratedProfile);
    }

    const documents = await LocalDatabaseService.getDocuments(localUserId);
    for (const document of documents) {
      await LocalDatabaseService.saveDocument(document, cloudUserId);
      await SupabaseRepository.upsertDocument(document, cloudUserId);
    }

    const metrics = await LocalDatabaseService.getReadingMetrics(localUserId);
    for (const metric of metrics) {
      await LocalDatabaseService.saveReadingMetrics(metric, cloudUserId);
      await SupabaseRepository.insertReadingMetrics(metric, cloudUserId);
    }

    const folders = await LocalDatabaseService.getFolders(localUserId);
    for (const folder of folders) {
      await LocalDatabaseService.saveFolder(folder, cloudUserId);
      await this.enqueueCloudSync('folder', folder.id, 'insert', folder);
    }

    const bookmarks = await LocalDatabaseService.getBookmarks(localUserId);
    for (const bookmark of bookmarks) {
      await LocalDatabaseService.saveBookmark(bookmark, cloudUserId);
      await this.enqueueCloudSync('bookmark', bookmark.id, 'insert', bookmark);
    }

    const annotations = await LocalDatabaseService.getAnnotations(localUserId);
    for (const annotation of annotations) {
      await LocalDatabaseService.saveAnnotation(annotation, cloudUserId);
      await this.enqueueCloudSync('annotation', annotation.id, 'insert', annotation);
    }

    await SyncEngine.syncIfPossible(this.session);
    logger.info('Local data merge complete', {
      documents: documents.length,
      folders: folders.length,
      bookmarks: bookmarks.length,
      annotations: annotations.length,
    });
  }
}

export default new DataService();
