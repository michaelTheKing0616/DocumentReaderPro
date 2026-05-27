import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../redux/store';
import { addPoints } from '../redux/gamificationSlice';
import GamificationService from '../services/gamification/GamificationService';

export const useGamification = () => {
  const dispatch = useDispatch();
  const gamification = useSelector((state: RootState) => state.gamification);

  const awardPoints = (points: number) => {
    dispatch(addPoints(points));
    void GamificationService.persistToSQLite();
  };

  const awardPagePoints = (pages: number) => {
    GamificationService.awardPointsForPage(pages);
  };

  const awardQuizPoints = (score: number) => {
    GamificationService.awardPointsForQuiz(score);
  };

  const updateDailyStreak = () => {
    GamificationService.updateDailyStreak();
  };

  const checkBadges = (metrics: {
    pagesRead: number;
    quizzesCompleted: number;
    regressions: number;
    streaks: number;
  }) => {
    GamificationService.checkBadges(metrics);
  };

  return {
    ...gamification,
    awardPoints,
    awardPagePoints,
    awardQuizPoints,
    updateDailyStreak,
    checkBadges,
  };
};

