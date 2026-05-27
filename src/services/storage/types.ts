import { Annotation, Document, ReadingMetrics, UserProfile } from '../../types';

export interface SessionUser {
  id: string;
  email?: string;
  isLocalOnly: boolean;
}

export interface Folder {
  id: string;
  name: string;
  parentId?: string;
  documentIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Bookmark {
  id: string;
  documentId: string;
  page: number;
  label?: string;
  position?: number;
  createdAt: string;
}

export interface StoredAnnotation extends Annotation {
  documentId: string;
}

export interface DocumentSearchResult {
  documentId: string;
  title: string;
  snippet: string;
  rank: number;
}

export type SyncOperation = 'insert' | 'update' | 'delete';
export type SyncEntityType =
  | 'document'
  | 'profile'
  | 'reading_metrics'
  | 'folder'
  | 'bookmark'
  | 'annotation'
  | 'gamification_state';

export interface SyncQueueItem {
  id: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  payload: string;
  createdAt: string;
  retryCount: number;
}

export interface ILocalDatabase {
  initialize(): Promise<void>;
  getLocalUserId(): Promise<string>;
  saveUserProfile(profile: UserProfile): Promise<void>;
  getUserProfile(userId: string): Promise<UserProfile | null>;
  saveDocument(document: Document, userId: string): Promise<void>;
  getDocuments(userId: string): Promise<Document[]>;
  saveReadingMetrics(metrics: ReadingMetrics, userId: string): Promise<void>;
  getReadingMetrics(userId: string, documentId?: string): Promise<ReadingMetrics[]>;
  enqueueSync(item: Omit<SyncQueueItem, 'id' | 'createdAt' | 'retryCount'>): Promise<void>;
  getPendingSyncItems(): Promise<SyncQueueItem[]>;
  removeSyncItem(id: string): Promise<void>;
  incrementSyncRetry(id: string): Promise<void>;
  saveFolder(folder: Folder, userId: string): Promise<void>;
  getFolders(userId: string): Promise<Folder[]>;
  deleteFolder(folderId: string, userId: string): Promise<void>;
  saveBookmark(bookmark: Bookmark, userId: string): Promise<void>;
  getBookmarks(userId: string, documentId?: string): Promise<Bookmark[]>;
  deleteBookmark(bookmarkId: string, userId: string): Promise<void>;
  saveAnnotation(annotation: StoredAnnotation, userId: string): Promise<void>;
  getAnnotations(userId: string, documentId?: string): Promise<StoredAnnotation[]>;
  deleteAnnotation(annotationId: string, userId: string): Promise<void>;
  indexDocumentText(
    documentId: string,
    userId: string,
    title: string,
    content: string
  ): Promise<void>;
  searchDocuments(query: string, userId: string, limit?: number): Promise<DocumentSearchResult[]>;
  removeDocumentIndex(documentId: string): Promise<void>;
}

export interface ISupabaseRepository {
  isConfigured(): boolean;
  signIn(email: string, password: string): Promise<SessionUser>;
  signUp(email: string, password: string): Promise<SessionUser>;
  signOut(): Promise<void>;
  getSession(): Promise<SessionUser | null>;
  upsertProfile(profile: UserProfile): Promise<void>;
  upsertDocument(document: Document, userId: string): Promise<void>;
  pullDocuments(userId: string): Promise<Document[]>;
  insertReadingMetrics(metrics: ReadingMetrics, userId: string): Promise<void>;
  pullReadingMetrics(userId: string, documentId?: string): Promise<ReadingMetrics[]>;
  uploadFile(localUri: string, storagePath: string): Promise<string>;
  upsertAnnotation(annotation: StoredAnnotation, userId: string): Promise<void>;
  upsertBookmark(bookmark: Bookmark, userId: string): Promise<void>;
  upsertFolder(folder: Folder, userId: string): Promise<void>;
  upsertGamificationState(userId: string, state: import('../../types').GamificationState): Promise<void>;
}
