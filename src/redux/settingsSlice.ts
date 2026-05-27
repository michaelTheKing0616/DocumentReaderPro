import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { HardwareType } from '../types';

export type ScrollMode = 'paged' | 'continuous';

interface SettingsState {
  hardwareType: HardwareType;
  scrollMode: ScrollMode;
}

const initialState: SettingsState = {
  hardwareType: 'none',
  scrollMode: 'paged',
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setHardwareType: (state, action: PayloadAction<HardwareType>) => {
      state.hardwareType = action.payload;
    },
    setScrollMode: (state, action: PayloadAction<ScrollMode>) => {
      state.scrollMode = action.payload;
    },
  },
});

export const { setHardwareType, setScrollMode } = settingsSlice.actions;
export default settingsSlice.reducer;
