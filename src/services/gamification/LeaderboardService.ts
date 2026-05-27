import { getSupabaseClient, isSupabaseConfigured, isSyncEnabled } from '../storage/supabase/SupabaseClient';
import { logger } from '../logger/Logger';

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  points: number;
  level: number;
  rank: number;
}

class LeaderboardService {
  async getTopEntries(limit = 10): Promise<LeaderboardEntry[]> {
    if (!isSupabaseConfigured() || !isSyncEnabled()) {
      return [];
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      return [];
    }
    try {
      const { data, error } = await supabase
        .from('gamification_state')
        .select('user_id, points, level, profiles(name)')
        .order('points', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return (data ?? []).map((row, index) => ({
        userId: row.user_id,
        displayName: (row.profiles as { name?: string } | null)?.name ?? 'Reader',
        points: row.points,
        level: row.level,
        rank: index + 1,
      }));
    } catch (error) {
      logger.warn('Leaderboard fetch failed', {
        message: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  async optIn(userId: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return;
    }
    await supabase.from('profiles').update({ preferences: { leaderboardOptIn: true } }).eq('id', userId);
  }
}

export default new LeaderboardService();
