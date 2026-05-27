import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { GamificationState, Badge, Challenge } from '../types';

const initialState: GamificationState = {
  points: 0,
  level: 1,
  badges: [],
  streaks: {
    current: 0,
    longest: 0,
    lastDate: new Date().toISOString().split('T')[0],
  },
  challenges: [],
};

const gamificationSlice = createSlice({
  name: 'gamification',
  initialState,
  reducers: {
    addPoints: (state, action: PayloadAction<number>) => {
      state.points += action.payload;
      // Level up every 1000 points
      const newLevel = Math.floor(state.points / 1000) + 1;
      if (newLevel > state.level) {
        state.level = newLevel;
      }
    },
    addBadge: (state, action: PayloadAction<Badge>) => {
      const existingBadge = state.badges.find((b) => b.id === action.payload.id);
      if (!existingBadge) {
        state.badges.push(action.payload);
      }
    },
    updateStreak: (state) => {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (state.streaks.lastDate === today) {
        // Already counted today
        return;
      } else if (state.streaks.lastDate === yesterdayStr) {
        // Consecutive day
        state.streaks.current += 1;
      } else {
        // Streak broken
        if (state.streaks.current > state.streaks.longest) {
          state.streaks.longest = state.streaks.current;
        }
        state.streaks.current = 1;
      }
      state.streaks.lastDate = today;
    },
    addChallenge: (state, action: PayloadAction<Challenge>) => {
      state.challenges.push(action.payload);
    },
    updateChallengeProgress: (
      state,
      action: PayloadAction<{ id: string; progress: number }>
    ) => {
      const challenge = state.challenges.find((c) => c.id === action.payload.id);
      if (challenge) {
        challenge.progress = action.payload.progress;
        if (challenge.progress >= challenge.target && !challenge.completed) {
          challenge.completed = true;
          state.points += challenge.reward;
        }
      }
    },
    resetGamification: () => initialState,
    setGamificationState: (_state, action: PayloadAction<GamificationState>) => {
      return action.payload;
    },
  },
});

export const {
  addPoints,
  addBadge,
  updateStreak,
  addChallenge,
  updateChallengeProgress,
  resetGamification,
  setGamificationState,
} = gamificationSlice.actions;

export default gamificationSlice.reducer;

