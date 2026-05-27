import { Badge, Challenge, GamificationState } from '../../types';
import { store } from '../../redux/store';
import {
  addPoints,
  addBadge,
  updateStreak,
  addChallenge,
  updateChallengeProgress,
  setGamificationState,
} from '../../redux/gamificationSlice';
import LocalDatabaseService from '../storage/local/LocalDatabaseService';
import DataService from '../storage/DataService';
import { getSupabaseClient, isSupabaseConfigured, isSyncEnabled } from '../storage/supabase/SupabaseClient';
import { logger } from '../logger/Logger';

class GamificationService {
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  async initialize(): Promise<void> {
    await this.loadFromSQLite();
  }

  private async resolveUserId(): Promise<string> {
    const session = DataService.getCurrentUser();
    if (session) {
      return session.id;
    }
    return LocalDatabaseService.getLocalUserId();
  }

  async loadFromSQLite(): Promise<void> {
    try {
      const userId = await this.resolveUserId();
      const saved = await LocalDatabaseService.getGamificationState(userId);
      if (saved) {
        store.dispatch(setGamificationState(saved));
        logger.info('Gamification state loaded from SQLite', { userId });
      }
    } catch (error) {
      logger.error('Failed to load gamification state', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private schedulePersist(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }
    this.persistTimer = setTimeout(() => {
      void this.persistToSQLite();
    }, 500);
  }

  async persistToSQLite(): Promise<void> {
    try {
      const userId = await this.resolveUserId();
      const state = store.getState().gamification;
      await LocalDatabaseService.saveGamificationState(userId, state);
      await this.syncToSupabase(userId, state);
    } catch (error) {
      logger.error('Failed to persist gamification state', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async syncToSupabase(userId: string, state: GamificationState): Promise<void> {
    if (!isSupabaseConfigured() || !isSyncEnabled()) {
      return;
    }
    const session = DataService.getCurrentUser();
    if (!session || session.isLocalOnly) {
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      return;
    }
    try {
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
      logger.debug('Gamification synced to Supabase', { userId });
    } catch (error) {
      logger.warn('Gamification Supabase sync failed', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  awardPointsForPage(pagesRead: number): void {
    const points = pagesRead * 10;
    store.dispatch(addPoints(points));
    this.schedulePersist();
  }

  awardPointsForQuiz(score: number): void {
    const points = Math.floor(score / 10);
    store.dispatch(addPoints(points));
    this.schedulePersist();
  }

  checkBadges(metrics: {
    pagesRead: number;
    quizzesCompleted: number;
    regressions: number;
    streaks: number;
  }): void {
    if (metrics.regressions < 5 && !this.hasBadge('focus-master')) {
      this.awardBadge({
        id: 'focus-master',
        name: 'Focus Master',
        description: 'Read with minimal regressions',
        icon: '🎯',
        unlockedAt: new Date(),
      });
    }

    if (metrics.pagesRead >= 100 && !this.hasBadge('bookworm')) {
      this.awardBadge({
        id: 'bookworm',
        name: 'Bookworm',
        description: 'Read 100 pages',
        icon: '📚',
        unlockedAt: new Date(),
      });
    }

    if (metrics.quizzesCompleted >= 50 && !this.hasBadge('scholar')) {
      this.awardBadge({
        id: 'scholar',
        name: 'Scholar',
        description: 'Complete 50 quizzes',
        icon: '🎓',
        unlockedAt: new Date(),
      });
    }

    if (metrics.streaks >= 30 && !this.hasBadge('streak-master')) {
      this.awardBadge({
        id: 'streak-master',
        name: 'Streak Master',
        description: 'Maintain a 30-day streak',
        icon: '🔥',
        unlockedAt: new Date(),
      });
    }
  }

  awardBadge(badge: Badge): void {
    store.dispatch(addBadge(badge));
    this.schedulePersist();
  }

  hasBadge(badgeId: string): boolean {
    const state = store.getState();
    return state.gamification.badges.some((b) => b.id === badgeId);
  }

  updateDailyStreak(): void {
    store.dispatch(updateStreak());
    this.schedulePersist();
  }

  addChallenge(challenge: Challenge): void {
    store.dispatch(addChallenge(challenge));
    this.schedulePersist();
  }

  updateChallenge(challengeId: string, progress: number): void {
    store.dispatch(updateChallengeProgress({ id: challengeId, progress }));
    this.schedulePersist();
  }

  createDefaultChallenges(): Challenge[] {
    return [
      {
        id: 'read-10-pages',
        name: 'Read 10 Pages',
        description: 'Read 10 pages without high regressions',
        target: 10,
        progress: 0,
        reward: 50,
        completed: false,
      },
      {
        id: 'complete-5-quizzes',
        name: 'Quiz Master',
        description: 'Complete 5 comprehension quizzes',
        target: 5,
        progress: 0,
        reward: 75,
        completed: false,
      },
    ];
  }
}

export default new GamificationService();
