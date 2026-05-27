import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Document, GamificationState, ReadingMetrics, UserProfile } from '../../../types';
import {
  Bookmark,
  DocumentSearchResult,
  Folder,
  ILocalDatabase,
  StoredAnnotation,
  SyncQueueItem,
} from '../types';
import { logger } from '../../logger/Logger';
import { generateIdSync } from '../../../utils/id';

const LOCAL_USER_ID_KEY = '@readassist/local_user_id';
const DB_NAME = 'readassist.db';

export interface LessonProgressRecord {
  lessonId: string;
  progress: number;
  completed: boolean;
  score?: number;
  updatedAt: string;
}

class LocalDatabaseService implements ILocalDatabase {
  private db: SQLite.SQLiteDatabase | null = null;

  async initialize(): Promise<void> {
    if (this.db) {
      return;
    }
    this.db = await SQLite.openDatabaseAsync(DB_NAME);
    await this.db.execAsync(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY NOT NULL,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS reading_metrics (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        document_id TEXT NOT NULL,
        data TEXT NOT NULL,
        recorded_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        retry_count INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
      CREATE INDEX IF NOT EXISTS idx_metrics_user_doc ON reading_metrics(user_id, document_id);

      CREATE TABLE IF NOT EXISTS gamification_state (
        user_id TEXT PRIMARY KEY NOT NULL,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS lesson_progress (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        lesson_id TEXT NOT NULL,
        progress INTEGER NOT NULL DEFAULT 0,
        completed INTEGER NOT NULL DEFAULT 0,
        score INTEGER,
        updated_at TEXT NOT NULL,
        UNIQUE(user_id, lesson_id)
      );

      CREATE INDEX IF NOT EXISTS idx_lesson_progress_user ON lesson_progress(user_id);

      CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS bookmarks (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        document_id TEXT NOT NULL,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS annotations (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        document_id TEXT NOT NULL,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS document_search USING fts5(
        document_id UNINDEXED,
        user_id UNINDEXED,
        title,
        content,
        tokenize='porter unicode61'
      );

      CREATE INDEX IF NOT EXISTS idx_folders_user ON folders(user_id);
      CREATE INDEX IF NOT EXISTS idx_bookmarks_user_doc ON bookmarks(user_id, document_id);
      CREATE INDEX IF NOT EXISTS idx_annotations_user_doc ON annotations(user_id, document_id);
    `);
    await this.getLocalUserId();
    logger.info('LocalDatabaseService initialized');
  }

  private requireDb(): SQLite.SQLiteDatabase {
    if (!this.db) {
      throw new Error('LocalDatabaseService not initialized');
    }
    return this.db;
  }

  async getLocalUserId(): Promise<string> {
    const existing = await AsyncStorage.getItem(LOCAL_USER_ID_KEY);
    if (existing) {
      return existing;
    }
    const id = `local-${generateIdSync()}`;
    await AsyncStorage.setItem(LOCAL_USER_ID_KEY, id);
    return id;
  }

  async saveUserProfile(profile: UserProfile): Promise<void> {
    const db = this.requireDb();
    const updatedAt = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO profiles (id, data, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
      [profile.id, JSON.stringify(profile), updatedAt]
    );
  }

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const db = this.requireDb();
    const row = await db.getFirstAsync<{ data: string }>(
      'SELECT data FROM profiles WHERE id = ?',
      [userId]
    );
    if (!row) {
      return null;
    }
    return JSON.parse(row.data) as UserProfile;
  }

  async saveDocument(document: Document, userId: string): Promise<void> {
    const db = this.requireDb();
    const updatedAt = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO documents (id, user_id, data, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
      [document.id, userId, JSON.stringify(document), updatedAt]
    );
  }

  async getDocuments(userId: string): Promise<Document[]> {
    const db = this.requireDb();
    const rows = await db.getAllAsync<{ data: string }>(
      'SELECT data FROM documents WHERE user_id = ? ORDER BY updated_at DESC',
      [userId]
    );
    return rows.map((row) => JSON.parse(row.data) as Document);
  }

  async saveReadingMetrics(metrics: ReadingMetrics, userId: string): Promise<void> {
    const db = this.requireDb();
    const id = `${metrics.documentId}-${metrics.pageNumber}-${metrics.timestamp}`;
    const recordedAt = new Date(metrics.timestamp).toISOString();
    await db.runAsync(
      `INSERT INTO reading_metrics (id, user_id, document_id, data, recorded_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data, recorded_at = excluded.recorded_at`,
      [id, userId, metrics.documentId, JSON.stringify(metrics), recordedAt]
    );
  }

  async getReadingMetrics(userId: string, documentId?: string): Promise<ReadingMetrics[]> {
    const db = this.requireDb();
    const rows = documentId
      ? await db.getAllAsync<{ data: string }>(
          'SELECT data FROM reading_metrics WHERE user_id = ? AND document_id = ? ORDER BY recorded_at DESC',
          [userId, documentId]
        )
      : await db.getAllAsync<{ data: string }>(
          'SELECT data FROM reading_metrics WHERE user_id = ? ORDER BY recorded_at DESC',
          [userId]
        );
    return rows.map((row) => JSON.parse(row.data) as ReadingMetrics);
  }

  async enqueueSync(
    item: Omit<SyncQueueItem, 'id' | 'createdAt' | 'retryCount'>
  ): Promise<void> {
    const db = this.requireDb();
    const id = generateIdSync();
    await db.runAsync(
      `INSERT INTO sync_queue (id, entity_type, entity_id, operation, payload, created_at, retry_count)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [id, item.entityType, item.entityId, item.operation, item.payload, new Date().toISOString()]
    );
  }

  async getPendingSyncItems(): Promise<SyncQueueItem[]> {
    const db = this.requireDb();
    const rows = await db.getAllAsync<{
      id: string;
      entity_type: string;
      entity_id: string;
      operation: string;
      payload: string;
      created_at: string;
      retry_count: number;
    }>('SELECT * FROM sync_queue ORDER BY created_at ASC LIMIT 100');

    return rows.map((row) => ({
      id: row.id,
      entityType: row.entity_type as SyncQueueItem['entityType'],
      entityId: row.entity_id,
      operation: row.operation as SyncQueueItem['operation'],
      payload: row.payload,
      createdAt: row.created_at,
      retryCount: row.retry_count,
    }));
  }

  async removeSyncItem(id: string): Promise<void> {
    const db = this.requireDb();
    await db.runAsync('DELETE FROM sync_queue WHERE id = ?', [id]);
  }

  async incrementSyncRetry(id: string): Promise<void> {
    const db = this.requireDb();
    await db.runAsync('UPDATE sync_queue SET retry_count = retry_count + 1 WHERE id = ?', [id]);
  }

  async saveGamificationState(userId: string, state: GamificationState): Promise<void> {
    const db = this.requireDb();
    const updatedAt = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO gamification_state (user_id, data, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
      [userId, JSON.stringify(state), updatedAt]
    );
  }

  async getGamificationState(userId: string): Promise<GamificationState | null> {
    const db = this.requireDb();
    const row = await db.getFirstAsync<{ data: string }>(
      'SELECT data FROM gamification_state WHERE user_id = ?',
      [userId]
    );
    if (!row) {
      return null;
    }
    return JSON.parse(row.data) as GamificationState;
  }

  async saveLessonProgress(userId: string, record: LessonProgressRecord): Promise<void> {
    const db = this.requireDb();
    const id = `${userId}-${record.lessonId}`;
    await db.runAsync(
      `INSERT INTO lesson_progress (id, user_id, lesson_id, progress, completed, score, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, lesson_id) DO UPDATE SET
         progress = excluded.progress,
         completed = excluded.completed,
         score = excluded.score,
         updated_at = excluded.updated_at`,
      [
        id,
        userId,
        record.lessonId,
        record.progress,
        record.completed ? 1 : 0,
        record.score ?? null,
        record.updatedAt,
      ]
    );
  }

  async getLessonProgress(userId: string): Promise<LessonProgressRecord[]> {
    const db = this.requireDb();
    const rows = await db.getAllAsync<{
      lesson_id: string;
      progress: number;
      completed: number;
      score: number | null;
      updated_at: string;
    }>(
      'SELECT lesson_id, progress, completed, score, updated_at FROM lesson_progress WHERE user_id = ?',
      [userId]
    );
    return rows.map((row) => ({
      lessonId: row.lesson_id,
      progress: row.progress,
      completed: row.completed === 1,
      score: row.score ?? undefined,
      updatedAt: row.updated_at,
    }));
  }

  async saveFolder(folder: Folder, userId: string): Promise<void> {
    const db = this.requireDb();
    const updatedAt = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO folders (id, user_id, data, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
      [folder.id, userId, JSON.stringify(folder), updatedAt]
    );
  }

  async getFolders(userId: string): Promise<Folder[]> {
    const db = this.requireDb();
    const rows = await db.getAllAsync<{ data: string }>(
      'SELECT data FROM folders WHERE user_id = ? ORDER BY updated_at DESC',
      [userId]
    );
    return rows.map((row) => JSON.parse(row.data) as Folder);
  }

  async deleteFolder(folderId: string, userId: string): Promise<void> {
    const db = this.requireDb();
    await db.runAsync('DELETE FROM folders WHERE id = ? AND user_id = ?', [folderId, userId]);
  }

  async saveBookmark(bookmark: Bookmark, userId: string): Promise<void> {
    const db = this.requireDb();
    const updatedAt = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO bookmarks (id, user_id, document_id, data, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
      [bookmark.id, userId, bookmark.documentId, JSON.stringify(bookmark), updatedAt]
    );
  }

  async getBookmarks(userId: string, documentId?: string): Promise<Bookmark[]> {
    const db = this.requireDb();
    const rows = documentId
      ? await db.getAllAsync<{ data: string }>(
          'SELECT data FROM bookmarks WHERE user_id = ? AND document_id = ? ORDER BY updated_at DESC',
          [userId, documentId]
        )
      : await db.getAllAsync<{ data: string }>(
          'SELECT data FROM bookmarks WHERE user_id = ? ORDER BY updated_at DESC',
          [userId]
        );
    return rows.map((row) => JSON.parse(row.data) as Bookmark);
  }

  async deleteBookmark(bookmarkId: string, userId: string): Promise<void> {
    const db = this.requireDb();
    await db.runAsync('DELETE FROM bookmarks WHERE id = ? AND user_id = ?', [bookmarkId, userId]);
  }

  async saveAnnotation(annotation: StoredAnnotation, userId: string): Promise<void> {
    const db = this.requireDb();
    const updatedAt = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO annotations (id, user_id, document_id, data, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
      [annotation.id, userId, annotation.documentId, JSON.stringify(annotation), updatedAt]
    );
  }

  async getAnnotations(userId: string, documentId?: string): Promise<StoredAnnotation[]> {
    const db = this.requireDb();
    const rows = documentId
      ? await db.getAllAsync<{ data: string }>(
          'SELECT data FROM annotations WHERE user_id = ? AND document_id = ? ORDER BY updated_at DESC',
          [userId, documentId]
        )
      : await db.getAllAsync<{ data: string }>(
          'SELECT data FROM annotations WHERE user_id = ? ORDER BY updated_at DESC',
          [userId]
        );
    return rows.map((row) => JSON.parse(row.data) as StoredAnnotation);
  }

  async deleteAnnotation(annotationId: string, userId: string): Promise<void> {
    const db = this.requireDb();
    await db.runAsync('DELETE FROM annotations WHERE id = ? AND user_id = ?', [annotationId, userId]);
  }

  async indexDocumentText(
    documentId: string,
    userId: string,
    title: string,
    content: string
  ): Promise<void> {
    const db = this.requireDb();
    await db.runAsync('DELETE FROM document_search WHERE document_id = ?', [documentId]);
    await db.runAsync(
      'INSERT INTO document_search (document_id, user_id, title, content) VALUES (?, ?, ?, ?)',
      [documentId, userId, title, content]
    );
  }

  async searchDocuments(
    query: string,
    userId: string,
    limit = 20
  ): Promise<DocumentSearchResult[]> {
    const db = this.requireDb();
    const sanitized = query.replace(/[^\w\s]/g, ' ').trim();
    if (!sanitized) {
      return [];
    }

    const ftsQuery = sanitized
      .split(/\s+/)
      .filter(Boolean)
      .map((term) => `"${term}"*`)
      .join(' ');

    const rows = await db.getAllAsync<{
      document_id: string;
      title: string;
      content: string;
      rank: number;
    }>(
      `SELECT document_id, title, content, bm25(document_search) AS rank
       FROM document_search
       WHERE document_search MATCH ? AND user_id = ?
       ORDER BY rank
       LIMIT ?`,
      [ftsQuery, userId, limit]
    );

    return rows.map((row) => ({
      documentId: row.document_id,
      title: row.title,
      snippet: this.buildSearchSnippet(row.content, sanitized),
      rank: row.rank,
    }));
  }

  async removeDocumentIndex(documentId: string): Promise<void> {
    const db = this.requireDb();
    await db.runAsync('DELETE FROM document_search WHERE document_id = ?', [documentId]);
  }

  private buildSearchSnippet(content: string, query: string, maxLength = 160): string {
    const lowerContent = content.toLowerCase();
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    let bestIndex = 0;

    for (const term of terms) {
      const index = lowerContent.indexOf(term);
      if (index >= 0) {
        bestIndex = Math.max(0, index - 40);
        break;
      }
    }

    const snippet = content.slice(bestIndex, bestIndex + maxLength).trim();
    return snippet.length < content.length ? `${snippet}…` : snippet;
  }
}

export default new LocalDatabaseService();
