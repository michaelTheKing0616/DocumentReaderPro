import DataService from '../storage/DataService';
import { Bookmark, Folder } from '../storage/types';
import { generateIdSync } from '../../utils/id';
import { logger } from '../logger/Logger';

class LibraryService {
  async createFolder(name: string, parentId?: string): Promise<Folder> {
    const folder: Folder = {
      id: generateIdSync(),
      name,
      parentId,
      documentIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await DataService.saveFolder(folder);
    logger.info('Folder created', { folderId: folder.id, name });
    return folder;
  }

  async getFolders(parentId?: string): Promise<Folder[]> {
    const folders = await DataService.getFolders();
    if (parentId === undefined) {
      return folders;
    }
    return folders.filter((folder) => folder.parentId === parentId);
  }

  async updateFolder(folderId: string, updates: Partial<Pick<Folder, 'name' | 'parentId'>>): Promise<Folder | null> {
    const folders = await DataService.getFolders();
    const existing = folders.find((folder) => folder.id === folderId);
    if (!existing) {
      return null;
    }
    const updated: Folder = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await DataService.saveFolder(updated);
    return updated;
  }

  async deleteFolder(folderId: string): Promise<void> {
    await DataService.deleteFolder(folderId);
    logger.info('Folder deleted', { folderId });
  }

  async addBookmark(
    documentId: string,
    page: number,
    label?: string,
    position?: number
  ): Promise<Bookmark> {
    const bookmark: Bookmark = {
      id: generateIdSync(),
      documentId,
      page,
      label,
      position,
      createdAt: new Date().toISOString(),
    };
    await DataService.saveBookmark(bookmark);
    logger.info('Bookmark saved', { bookmarkId: bookmark.id, documentId, page });
    return bookmark;
  }

  async getBookmarks(documentId?: string): Promise<Bookmark[]> {
    return DataService.getBookmarks(documentId);
  }

  async deleteBookmark(bookmarkId: string): Promise<void> {
    await DataService.deleteBookmark(bookmarkId);
    logger.info('Bookmark deleted', { bookmarkId });
  }

  async assignDocumentToFolder(documentId: string, folderId: string): Promise<Folder | null> {
    const folders = await DataService.getFolders();
    const folder = folders.find((item) => item.id === folderId);
    if (!folder) {
      return null;
    }
    const documentIds = Array.from(new Set([...(folder.documentIds ?? []), documentId]));
    const updated: Folder = {
      ...folder,
      documentIds,
      updatedAt: new Date().toISOString(),
    };
    await DataService.saveFolder(updated);
    logger.info('Document assigned to folder', { documentId, folderId });
    return updated;
  }

  async removeDocumentFromFolder(documentId: string, folderId: string): Promise<void> {
    const folders = await DataService.getFolders();
    const folder = folders.find((item) => item.id === folderId);
    if (!folder) {
      return;
    }
    const documentIds = (folder.documentIds ?? []).filter((id) => id !== documentId);
    await DataService.saveFolder({ ...folder, documentIds, updatedAt: new Date().toISOString() });
  }

  async moveDocumentToFolder(documentId: string, targetFolderId: string | null): Promise<void> {
    const folders = await DataService.getFolders();
    for (const folder of folders) {
      if ((folder.documentIds ?? []).includes(documentId)) {
        await this.removeDocumentFromFolder(documentId, folder.id);
      }
    }
    if (targetFolderId) {
      await this.assignDocumentToFolder(documentId, targetFolderId);
    }
  }
}

export default new LibraryService();
