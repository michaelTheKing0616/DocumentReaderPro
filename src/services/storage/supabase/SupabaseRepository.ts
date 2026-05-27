import { Document, GamificationState, ReadingMetrics, UserProfile } from '../../../types';
import { ISupabaseRepository, SessionUser, Bookmark, Folder, StoredAnnotation } from '../types';
import { getSupabaseClient, isSupabaseConfigured } from './SupabaseClient';
import { logger } from '../../logger/Logger';

class SupabaseRepository implements ISupabaseRepository {
  isConfigured(): boolean {
    return isSupabaseConfigured();
  }

  async signIn(email: string, password: string): Promise<SessionUser> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase is not configured');
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      throw error ?? new Error('Sign in failed');
    }
    return { id: data.user.id, email: data.user.email ?? undefined, isLocalOnly: false };
  }

  async signUp(email: string, password: string): Promise<SessionUser> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase is not configured');
    }
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error || !data.user) {
      throw error ?? new Error('Sign up failed');
    }
    return { id: data.user.id, email: data.user.email ?? undefined, isLocalOnly: false };
  }

  async signOut(): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return;
    }
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
  }

  async getSession(): Promise<SessionUser | null> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return null;
    }
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      logger.error('Supabase getSession failed', { message: error.message });
      return null;
    }
    const user = data.session?.user;
    if (!user) {
      return null;
    }
    return { id: user.id, email: user.email ?? undefined, isLocalOnly: false };
  }

  async upsertProfile(profile: UserProfile): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return;
    }
    const { error } = await supabase.from('profiles').upsert({
      id: profile.id,
      name: profile.name ?? null,
      challenges: profile.challenges,
      preferences: profile.preferences,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      throw error;
    }
  }

  async upsertDocument(document: Document, userId: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return;
    }
    const { error } = await supabase.from('documents').upsert({
      id: document.id,
      user_id: userId,
      title: document.title,
      format: document.format,
      page_count: document.pageCount ?? null,
      progress: document.progress ?? 0,
      metadata: {
        filePath: document.filePath,
        thumbnailPath: document.thumbnailPath,
        uploadDate: document.uploadDate,
        lastRead: document.lastRead,
      },
      updated_at: new Date().toISOString(),
    });
    if (error) {
      throw error;
    }
  }

  async pullDocuments(userId: string): Promise<Document[]> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return [];
    }
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    if (error) {
      throw error;
    }
    return (data ?? []).map((row) => {
      const metadata = (row.metadata ?? {}) as Record<string, unknown>;
      return {
        id: row.id,
        title: row.title,
        format: row.format,
        filePath: String(metadata.filePath ?? ''),
        thumbnailPath: metadata.thumbnailPath as string | undefined,
        pageCount: row.page_count ?? undefined,
        uploadDate: metadata.uploadDate ? new Date(String(metadata.uploadDate)) : new Date(),
        lastRead: metadata.lastRead ? new Date(String(metadata.lastRead)) : undefined,
        progress: row.progress ?? undefined,
      } as Document;
    });
  }

  async insertReadingMetrics(metrics: ReadingMetrics, userId: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return;
    }
    const { error } = await supabase.from('reading_metrics').insert({
      user_id: userId,
      document_id: metrics.documentId,
      page_number: metrics.pageNumber,
      eye_metrics: metrics.eyeMetrics,
      reading_speed: metrics.readingSpeed,
      comprehension_score: metrics.comprehensionScore ?? null,
      time_spent_ms: metrics.timeSpent,
      recorded_at: new Date(metrics.timestamp).toISOString(),
    });
    if (error) {
      throw error;
    }
  }

  async pullReadingMetrics(userId: string, documentId?: string): Promise<ReadingMetrics[]> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return [];
    }
    let query = supabase.from('reading_metrics').select('*').eq('user_id', userId);
    if (documentId) {
      query = query.eq('document_id', documentId);
    }
    const { data, error } = await query.order('recorded_at', { ascending: false });
    if (error) {
      throw error;
    }
    return (data ?? []).map((row) => ({
      documentId: row.document_id,
      pageNumber: row.page_number,
      eyeMetrics: row.eye_metrics,
      readingSpeed: row.reading_speed ?? 0,
      comprehensionScore: row.comprehension_score ?? undefined,
      timeSpent: row.time_spent_ms,
      timestamp: new Date(row.recorded_at),
    })) as ReadingMetrics[];
  }

  async uploadFile(localUri: string, storagePath: string): Promise<string> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase is not configured');
    }
    const response = await fetch(localUri);
    const blob = await response.blob();
    const { error } = await supabase.storage.from('documents').upload(storagePath, blob, {
      upsert: true,
      contentType: 'application/octet-stream',
    });
    if (error) {
      throw error;
    }
    const { data } = supabase.storage.from('documents').getPublicUrl(storagePath);
    return data.publicUrl;
  }

  async upsertAnnotation(annotation: StoredAnnotation, userId: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return;
    }
    const { error } = await supabase.from('annotations').upsert({
      id: annotation.id,
      document_id: annotation.documentId,
      user_id: userId,
      type: annotation.type,
      page: annotation.page,
      geometry: {
        x: annotation.x,
        y: annotation.y,
        width: annotation.width,
        height: annotation.height,
      },
      content: {
        color: annotation.color,
        text: annotation.text,
        timestamp: annotation.timestamp,
      },
      updated_at: new Date().toISOString(),
    });
    if (error) {
      throw error;
    }
  }

  async upsertBookmark(bookmark: Bookmark, userId: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return;
    }
    const { error } = await supabase.from('bookmarks').upsert({
      id: bookmark.id,
      user_id: userId,
      document_id: bookmark.documentId,
      page: bookmark.page,
      label: bookmark.label ?? null,
      position: bookmark.position ?? null,
      created_at: bookmark.createdAt,
    });
    if (error) {
      throw error;
    }
  }

  async upsertFolder(folder: Folder, userId: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return;
    }
    const { error } = await supabase.from('folders').upsert({
      id: folder.id,
      user_id: userId,
      name: folder.name,
      parent_id: folder.parentId ?? null,
      document_ids: folder.documentIds ?? [],
      updated_at: folder.updatedAt,
    });
    if (error) {
      throw error;
    }
  }

  async upsertGamificationState(userId: string, state: GamificationState): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return;
    }
    const { error } = await supabase.from('gamification_state').upsert({
      user_id: userId,
      points: state.points,
      level: state.level,
      badges: state.badges,
      streaks: state.streaks,
      challenges: state.challenges,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      throw error;
    }
  }
}

export default new SupabaseRepository();
