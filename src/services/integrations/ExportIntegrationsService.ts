import { Document, ReadingMetrics } from '../../types';
import { logger } from '../logger/Logger';
import StripeService from '../billing/StripeService';
import SecureTokenStore from '../security/SecureTokenStore';
import { getSupabaseClient, isSupabaseConfigured } from '../storage/supabase/SupabaseClient';

export type ExportTarget = 'evernote' | 'goodreads';

const EVERNOTE_TOKEN_KEY = 'evernote_oauth';
const GOODREADS_TOKEN_KEY = 'goodreads_oauth';

export interface EvernoteExportPayload {
  title: string;
  content: string;
  notebookGuid?: string;
}

export interface GoodreadsExportPayload {
  title: string;
  author?: string;
  isbn?: string;
  dateRead?: string;
  rating?: number;
}

class ExportIntegrationsService {
  private evernoteToken: string | null = null;
  private goodreadsToken: string | null = null;
  private tokensLoaded = false;

  isEvernoteConfigured(): boolean {
    return Boolean(process.env.EXPO_PUBLIC_EVERNOTE_CONSUMER_KEY);
  }

  isGoodreadsConfigured(): boolean {
    return Boolean(process.env.EXPO_PUBLIC_GOODREADS_API_KEY);
  }

  getEvernoteAuthUrl(): string {
    const consumerKey = process.env.EXPO_PUBLIC_EVERNOTE_CONSUMER_KEY ?? '';
    const callback = encodeURIComponent('readassist://oauth/evernote');
    const sandbox = process.env.EXPO_PUBLIC_EVERNOTE_SANDBOX !== 'false';
    const host = sandbox ? 'sandbox.evernote.com' : 'www.evernote.com';
    return `https://${host}/OAuth.action?oauth_consumer_key=${consumerKey}&oauth_callback=${callback}`;
  }

  async loadTokensFromSecureStorage(): Promise<void> {
    if (this.tokensLoaded) {
      return;
    }
    this.evernoteToken = await SecureTokenStore.getToken(EVERNOTE_TOKEN_KEY);
    this.goodreadsToken = await SecureTokenStore.getToken(GOODREADS_TOKEN_KEY);
    this.tokensLoaded = true;
  }

  async setEvernoteToken(token: string): Promise<void> {
    this.evernoteToken = token.trim();
    await SecureTokenStore.setToken(EVERNOTE_TOKEN_KEY, this.evernoteToken);
  }

  async setGoodreadsToken(token: string): Promise<void> {
    this.goodreadsToken = token.trim();
    await SecureTokenStore.setToken(GOODREADS_TOKEN_KEY, this.goodreadsToken);
  }

  async disconnectEvernote(): Promise<void> {
    this.evernoteToken = null;
    await SecureTokenStore.removeToken(EVERNOTE_TOKEN_KEY);
  }

  async disconnectGoodreads(): Promise<void> {
    this.goodreadsToken = null;
    await SecureTokenStore.removeToken(GOODREADS_TOKEN_KEY);
  }

  async isEvernoteConnected(): Promise<boolean> {
    await this.loadTokensFromSecureStorage();
    return Boolean(this.evernoteToken);
  }

  async isGoodreadsConnected(): Promise<boolean> {
    await this.loadTokensFromSecureStorage();
    return Boolean(this.goodreadsToken ?? process.env.EXPO_PUBLIC_GOODREADS_API_KEY);
  }

  private async getEvernoteToken(): Promise<string> {
    await this.loadTokensFromSecureStorage();
    if (this.evernoteToken) {
      return this.evernoteToken;
    }
    throw new Error('Evernote OAuth token not found — connect in Settings');
  }

  private async getGoodreadsToken(): Promise<string> {
    await this.loadTokensFromSecureStorage();
    if (this.goodreadsToken) {
      return this.goodreadsToken;
    }
    const apiKey = process.env.EXPO_PUBLIC_GOODREADS_API_KEY;
    if (apiKey) {
      return apiKey;
    }
    throw new Error('Goodreads token not configured');
  }

  async exportToEvernote(payload: EvernoteExportPayload): Promise<{ noteId: string }> {
    if (!StripeService.canAccess('export_integrations')) {
      throw new Error('Evernote export requires Premium');
    }
    const token = await this.getEvernoteToken();

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data, error } = await supabase.functions.invoke('evernote-create-note', {
          body: {
            oauthToken: token,
            title: payload.title,
            content: payload.content,
            notebookGuid: payload.notebookGuid,
            sandbox: process.env.EXPO_PUBLIC_EVERNOTE_SANDBOX !== 'false',
          },
        });
        if (!error && data?.noteId) {
          logger.info('Evernote export complete', { noteId: data.noteId });
          return { noteId: data.noteId as string };
        }
        logger.warn('Evernote edge function failed', { message: error?.message });
      }
    }

    throw new Error('Evernote export requires Supabase edge function evernote-create-note');
  }

  async exportDocumentNotes(document: Document, notes: string): Promise<{ noteId: string }> {
    return this.exportToEvernote({
      title: `ReadAssist: ${document.title}`,
      content: notes,
    });
  }

  private async searchGoodreadsBookId(title: string, author?: string): Promise<string | null> {
    const token = await this.getGoodreadsToken();
    const query = author ? `${title} ${author}` : title;
    const url = `https://www.goodreads.com/search/index.xml?key=${encodeURIComponent(token)}&q=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    const xml = await response.text();
    const match = xml.match(/<id type="integer">(\d+)<\/id>/);
    return match?.[1] ?? null;
  }

  async exportToGoodreads(payload: GoodreadsExportPayload): Promise<{ shelfId: string; bookId?: string }> {
    if (!StripeService.canAccess('export_integrations')) {
      throw new Error('Goodreads export requires Premium');
    }
    const token = await this.getGoodreadsToken();

    let bookId = payload.isbn ? payload.isbn : null;
    if (!bookId) {
      bookId = await this.searchGoodreadsBookId(payload.title, payload.author);
    }
    if (!bookId) {
      throw new Error(`Goodreads book not found for "${payload.title}"`);
    }

    const shelfParams = new URLSearchParams({
      format: 'xml',
      key: token,
      name: 'read',
      book_id: bookId,
    });

    const shelfResponse = await fetch(
      `https://www.goodreads.com/book/shelf/add.xml?${shelfParams.toString()}`,
      { method: 'POST' }
    );

    if (!shelfResponse.ok) {
      const text = await shelfResponse.text();
      logger.error('Goodreads shelf add failed', { status: shelfResponse.status, text });
      throw new Error(`Goodreads export failed (${shelfResponse.status})`);
    }

    if (payload.rating) {
      const reviewParams = new URLSearchParams({
        format: 'xml',
        key: token,
        book_id: bookId,
        'review[rating]': String(payload.rating),
        'review[read_at]': payload.dateRead ?? new Date().toISOString().split('T')[0],
      });
      await fetch(`https://www.goodreads.com/review/edit.xml?${reviewParams.toString()}`, {
        method: 'POST',
      });
    }

    const shelfId = `gr_${bookId}`;
    logger.info('Goodreads export complete', { title: payload.title, bookId, shelfId });
    return { shelfId, bookId };
  }

  async exportReadingSummary(metrics: ReadingMetrics[], bookTitle: string): Promise<{ shelfId: string }> {
    const avgSpeed =
      metrics.length > 0
        ? metrics.reduce((s, m) => s + m.readingSpeed, 0) / metrics.length
        : 0;
    const result = await this.exportToGoodreads({
      title: bookTitle,
      dateRead: new Date().toISOString().split('T')[0],
      rating: avgSpeed > 200 ? 5 : avgSpeed > 150 ? 4 : 3,
    });
    return { shelfId: result.shelfId };
  }
}

export default new ExportIntegrationsService();
