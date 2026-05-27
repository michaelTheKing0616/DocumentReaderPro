import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { UserProfile, UserPreferences, ReadingChallenge } from '../types';

interface UserState {
  profile: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const defaultPreferences: UserPreferences = {
  fontSize: 16,
  fontFamily: 'System',
  lineSpacing: 1.5,
  theme: 'light',
  ttsEnabled: false,
  ttsSpeed: 150,
  eyeTrackingEnabled: false,
  arOverlaysEnabled: false,
  brightnessAutoAdjust: false,
};

const initialState: UserState = {
  profile: null,
  isAuthenticated: false,
  isLoading: false,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setProfile: (state, action: PayloadAction<UserProfile>) => {
      state.profile = action.payload;
      state.isAuthenticated = true;
    },
    updatePreferences: (state, action: PayloadAction<Partial<UserPreferences>>) => {
      if (state.profile) {
        state.profile.preferences = {
          ...state.profile.preferences,
          ...action.payload,
        };
      }
    },
    setChallenges: (state, action: PayloadAction<ReadingChallenge[]>) => {
      if (state.profile) {
        state.profile.challenges = action.payload;
        // Apply evidence-based defaults
        if (action.payload.includes('dyslexia')) {
          state.profile.preferences = {
            ...state.profile.preferences,
            fontFamily: 'OpenDyslexic',
            lineSpacing: 1.5,
            ttsSpeed: 150,
            arOverlaysEnabled: true,
          };
        }
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    logout: () => initialState,
  },
});

export const {
  setProfile,
  updatePreferences,
  setChallenges,
  setLoading,
  logout,
} = userSlice.actions;

export default userSlice.reducer;

