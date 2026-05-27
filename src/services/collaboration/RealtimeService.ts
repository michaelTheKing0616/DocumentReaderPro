import { getSupabaseClient, isSupabaseConfigured } from '../storage/supabase/SupabaseClient';
import { logger } from '../logger/Logger';

export type RealtimeChannel = 'reading_session' | 'annotations' | 'gamification';

export interface RealtimePayload {
  channel: RealtimeChannel;
  event: string;
  payload: Record<string, unknown>;
  userId?: string;
  documentId?: string;
}

export interface PresenceUser {
  userId: string;
  userName: string;
  onlineAt: string;
}

type MessageHandler = (payload: RealtimePayload) => void;
type PresenceHandler = (users: PresenceUser[]) => void;

class RealtimeService {
  private handlers: Map<RealtimeChannel, Set<MessageHandler>> = new Map();
  private presenceHandlers: Set<PresenceHandler> = new Set();
  private subscribed = false;
  private activeChannelName: string | null = null;
  private presentUsers: PresenceUser[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private channel: any = null;

  isAvailable(): boolean {
    return isSupabaseConfigured() && getSupabaseClient() !== null;
  }

  subscribe(userId: string, documentId?: string, userName?: string): void {
    const supabase = getSupabaseClient();
    if (!supabase) {
      logger.warn('RealtimeService: Supabase not configured');
      return;
    }

    const channelName = documentId ? `doc:${documentId}` : `user:${userId}`;
    this.activeChannelName = channelName;
    this.channel = supabase.channel(channelName, {
      config: { presence: { key: userId } },
    });

    this.channel
      .on('broadcast', { event: 'reading_update' }, ({ payload }) => {
        const data = payload as Record<string, unknown>;
        this.dispatch({
          channel: 'reading_session',
          event: 'reading_update',
          payload: data,
          userId: (data.userId as string | undefined) ?? userId,
          documentId,
        });
      })
      .on('broadcast', { event: 'annotation_update' }, ({ payload }) => {
        this.dispatch({
          channel: 'annotations',
          event: 'annotation_update',
          payload: payload as Record<string, unknown>,
          userId,
          documentId,
        });
      })
      .on('broadcast', { event: 'gamification_update' }, ({ payload }) => {
        this.dispatch({
          channel: 'gamification',
          event: 'gamification_update',
          payload: payload as Record<string, unknown>,
          userId,
        });
      })
      .on('presence', { event: 'sync' }, () => {
        const state = this.channel.presenceState<PresenceUser>();
        const users: PresenceUser[] = [];
        Object.values(state).forEach((entries) => {
          entries.forEach((entry) => {
            if (entry.userId && entry.userName) {
              users.push(entry);
            }
          });
        });
        this.presentUsers = users;
        this.presenceHandlers.forEach((h) => h(users));
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        logger.debug('Presence join', { count: newPresences.length });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        logger.debug('Presence leave', { count: leftPresences.length });
      })
      .subscribe(async (status: string) => {
        logger.info('Realtime channel status', { channelName, status });
        this.subscribed = status === 'SUBSCRIBED';
        if (status === 'SUBSCRIBED') {
          await this.channel.track({
            userId,
            userName: userName ?? `User ${userId.slice(0, 6)}`,
            onlineAt: new Date().toISOString(),
          });
        }
      });
  }

  async broadcast(channel: RealtimeChannel, event: string, payload: Record<string, unknown>): Promise<void> {
    if (!this.channel || !this.activeChannelName) {
      return;
    }
    await this.channel.send({
      type: 'broadcast',
      event,
      payload: { ...payload, _channel: channel },
    });
  }

  on(channel: RealtimeChannel, handler: MessageHandler): () => void {
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());
    }
    this.handlers.get(channel)!.add(handler);
    return () => {
      this.handlers.get(channel)?.delete(handler);
    };
  }

  onPresenceChange(handler: PresenceHandler): () => void {
    this.presenceHandlers.add(handler);
    if (this.presentUsers.length > 0) {
      handler(this.presentUsers);
    }
    return () => {
      this.presenceHandlers.delete(handler);
    };
  }

  getPresentUsers(): PresenceUser[] {
    return [...this.presentUsers];
  }

  private dispatch(message: RealtimePayload): void {
    const set = this.handlers.get(message.channel);
    if (!set) return;
    set.forEach((h) => h(message));
  }

  isSubscribed(): boolean {
    return this.subscribed;
  }

  unsubscribe(): void {
    const supabase = getSupabaseClient();
    if (supabase) {
      supabase.removeAllChannels();
    }
    this.channel = null;
    this.subscribed = false;
    this.activeChannelName = null;
    this.presentUsers = [];
  }
}

export default new RealtimeService();
