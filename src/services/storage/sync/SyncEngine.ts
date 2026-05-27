import LocalDatabaseService from '../local/LocalDatabaseService';
import SupabaseRepository from '../supabase/SupabaseRepository';
import { isSyncEnabled } from '../supabase/SupabaseClient';
import { SessionUser, SyncQueueItem, Bookmark, Folder, StoredAnnotation } from '../types';
import { Document, GamificationState, ReadingMetrics, UserProfile } from '../../../types';
import { logger } from '../../logger/Logger';

const MAX_SYNC_RETRIES = 5;

class SyncEngine {
  private isSyncing = false;

  async syncIfPossible(session: SessionUser | null): Promise<void> {
    if (!session || session.isLocalOnly || !SupabaseRepository.isConfigured() || !isSyncEnabled()) {
      return;
    }
    if (this.isSyncing) {
      return;
    }
    this.isSyncing = true;
    try {
      await this.drainQueue(session);
      await this.pullRemoteChanges(session);
    } catch (error) {
      logger.error('SyncEngine sync failed', {
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.isSyncing = false;
    }
  }

  private async drainQueue(session: SessionUser): Promise<void> {
    const items = await LocalDatabaseService.getPendingSyncItems();
    for (const item of items) {
      await this.processQueueItem(item, session);
    }
  }

  private async processQueueItem(item: SyncQueueItem, session: SessionUser): Promise<void> {
    if (item.retryCount >= MAX_SYNC_RETRIES) {
      logger.warn('Sync item exceeded retry limit', { id: item.id, entityType: item.entityType });
      await LocalDatabaseService.removeSyncItem(item.id);
      return;
    }
    try {
      const payload = JSON.parse(item.payload);
      switch (item.entityType) {
        case 'profile':
          await SupabaseRepository.upsertProfile(payload as UserProfile);
          break;
        case 'document':
          await SupabaseRepository.upsertDocument(payload as Document, session.id);
          break;
        case 'reading_metrics':
          await SupabaseRepository.insertReadingMetrics(payload as ReadingMetrics, session.id);
          break;
        case 'annotation':
          await SupabaseRepository.upsertAnnotation(payload as StoredAnnotation, session.id);
          break;
        case 'bookmark':
          await SupabaseRepository.upsertBookmark(payload as Bookmark, session.id);
          break;
        case 'folder':
          await SupabaseRepository.upsertFolder(payload as Folder, session.id);
          break;
        case 'gamification_state':
          await SupabaseRepository.upsertGamificationState(
            session.id,
            payload as GamificationState
          );
          break;
        default:
          logger.debug('SyncEngine skipping unknown entity', { entityType: item.entityType });
          break;
      }
      await LocalDatabaseService.removeSyncItem(item.id);
    } catch (error) {
      await LocalDatabaseService.incrementSyncRetry(item.id);
      logger.warn('Sync queue item failed', {
        id: item.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async pullRemoteChanges(session: SessionUser): Promise<void> {
    const remoteDocs = await SupabaseRepository.pullDocuments(session.id);
    for (const doc of remoteDocs) {
      const localDocs = await LocalDatabaseService.getDocuments(session.id);
      const exists = localDocs.some((d) => d.id === doc.id);
      if (!exists && doc.filePath) {
        await LocalDatabaseService.saveDocument(doc, session.id);
      }
    }
  }
}

export default new SyncEngine();
