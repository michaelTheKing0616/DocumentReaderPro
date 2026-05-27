import LocalDatabaseService, { LessonProgressRecord } from '../storage/local/LocalDatabaseService';
import DataService from '../storage/DataService';
import { logger } from '../logger/Logger';

export type { LessonProgressRecord } from '../storage/local/LocalDatabaseService';

class LessonProgressService {
  async getProgressForUser(userId?: string): Promise<Map<string, LessonProgressRecord>> {
    const uid = userId ?? (await this.resolveUserId());
    const rows = await LocalDatabaseService.getLessonProgress(uid);
    const map = new Map<string, LessonProgressRecord>();
    for (const row of rows) {
      map.set(row.lessonId, row);
    }
    return map;
  }

  async getLessonProgress(lessonId: string, userId?: string): Promise<LessonProgressRecord | null> {
    const all = await this.getProgressForUser(userId);
    return all.get(lessonId) ?? null;
  }

  async updateProgress(
    lessonId: string,
    progress: number,
    options?: { completed?: boolean; score?: number; userId?: string }
  ): Promise<void> {
    const uid = options?.userId ?? (await this.resolveUserId());
    const clamped = Math.max(0, Math.min(100, progress));
    const record: LessonProgressRecord = {
      lessonId,
      progress: clamped,
      completed: options?.completed ?? clamped >= 100,
      score: options?.score,
      updatedAt: new Date().toISOString(),
    };
    await LocalDatabaseService.saveLessonProgress(uid, record);
    logger.info('Lesson progress saved', { lessonId, progress: clamped, userId: uid });
  }

  async markCompleted(lessonId: string, score?: number, userId?: string): Promise<void> {
    await this.updateProgress(lessonId, 100, { completed: true, score, userId });
  }

  async getCompletionStats(userId?: string): Promise<{
    completedCount: number;
    totalMinutes: number;
    completedMinutes: number;
  }> {
    const uid = userId ?? (await this.resolveUserId());
    const rows = await LocalDatabaseService.getLessonProgress(uid);
    const completed = rows.filter((r) => r.completed);
    return {
      completedCount: completed.length,
      totalMinutes: 0,
      completedMinutes: 0,
    };
  }

  private async resolveUserId(): Promise<string> {
    const session = DataService.getCurrentUser();
    if (session) {
      return session.id;
    }
    return LocalDatabaseService.getLocalUserId();
  }
}

export default new LessonProgressService();
