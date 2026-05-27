import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { UXPreferences } from '../types';

interface UXState {
  preferences: UXPreferences;
  isOnboardingComplete: boolean;
  currentTour?: string;
  currentTourStep?: number;
  tourCompleted?: boolean;
}

const initialState: UXState = {
  preferences: {
    animationSpeed: 'normal',
    hapticFeedback: true,
    voiceCommands: false,
    gestureControls: true,
    theme: 'auto',
  },
  isOnboardingComplete: false,
  currentTour: undefined,
  currentTourStep: 0,
  tourCompleted: false,
};

const uxSlice = createSlice({
  name: 'ux',
  initialState,
  reducers: {
    setUXPreferences: (state, action: PayloadAction<Partial<UXPreferences>>) => {
      state.preferences = {
        ...state.preferences,
        ...action.payload,
      };
    },
    setOnboardingComplete: (state, action: PayloadAction<boolean>) => {
      state.isOnboardingComplete = action.payload;
    },
    setCurrentTour: (state, action: PayloadAction<string | undefined>) => {
      state.currentTour = action.payload;
    },
    setTourStep: (state, action: PayloadAction<number>) => {
      state.currentTourStep = action.payload;
    },
    completeTour: (state) => {
      state.tourCompleted = true;
      state.currentTour = undefined;
    },
    startTour: (state) => {
      state.tourCompleted = false;
      state.currentTour = 'main';
      state.currentTourStep = 0;
    },
  },
});

export const {
  setUXPreferences,
  setOnboardingComplete,
  setCurrentTour,
  setTourStep,
  completeTour,
  startTour,
} = uxSlice.actions;

export default uxSlice.reducer;

