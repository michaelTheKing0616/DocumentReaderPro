import { configureStore } from '@reduxjs/toolkit';
import gamificationReducer from './gamificationSlice';
import userReducer from './userSlice';
import uxReducer from './uxSlice';
import settingsReducer from './settingsSlice';

export const store = configureStore({
  reducer: {
    gamification: gamificationReducer,
    user: userReducer,
    ux: uxReducer,
    settings: settingsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['gamification/addBadge', 'user/setProfile'],
        ignoredPaths: ['gamification.badges', 'user.profile'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

