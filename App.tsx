import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Provider, useSelector } from 'react-redux';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { store, RootState } from './src/redux/store';
import { AppNavigator } from './src/navigation/AppNavigator';
import { SyncProvider } from './src/components/SyncProvider';
import { OnboardingTour } from './src/components/onboarding/OnboardingTour';
import DataService from './src/services/storage/DataService';
import GamificationService from './src/services/gamification/GamificationService';
import NotificationService from './src/services/notifications/NotificationService';
import FontLoader from './src/services/fonts/FontLoader';
import { logger } from './src/services/logger/Logger';
import { ThemeProvider } from './src/theme/ThemeProvider';

function AppContent() {
  const isOnboardingComplete = useSelector((state: RootState) => state.ux.isOnboardingComplete);
  const tourCompleted = useSelector((state: RootState) => state.ux.tourCompleted);
  const showTour = isOnboardingComplete && !tourCompleted;

  useEffect(() => {
    void DataService.initialize().then(async () => {
      await GamificationService.initialize();
      await NotificationService.initialize();
      await NotificationService.scheduleStreakReminder();
    });
  }, []);

  return (
    <>
      <StatusBar style="auto" />
      <AppNavigator />
      <OnboardingTour visible={showTour} />
    </>
  );
}

export default function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    void FontLoader.load()
      .then(() => setIsReady(true))
      .catch((error) => {
        logger.error('App font bootstrap failed', { error: String(error) });
        setIsReady(true);
      });
  }, []);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Provider store={store}>
          <ThemeProvider>
            <SyncProvider>
              <AppContent />
            </SyncProvider>
          </ThemeProvider>
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
