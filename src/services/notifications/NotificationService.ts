import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { logger } from '../logger/Logger';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

class NotificationService {
  private initialized = false;

  async initialize(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }
    try {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        logger.warn('Notification permissions not granted');
        return false;
      }
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('reading', {
          name: 'Reading reminders',
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      }
      this.initialized = true;
      return true;
    } catch (error) {
      logger.error('NotificationService init failed', {
        message: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async scheduleBreakReminder(minutesFromNow: number): Promise<string | null> {
    if (!(await this.initialize())) {
      return null;
    }
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Reading break',
          body: 'Your engagement dropped — take a short break.',
        },
        trigger: { seconds: minutesFromNow * 60 },
      });
      return id;
    } catch (error) {
      logger.warn('Failed to schedule break reminder', {
        message: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async scheduleStreakReminder(hour = 19, minute = 0): Promise<string | null> {
    if (!(await this.initialize())) {
      return null;
    }
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Keep your streak!',
          body: 'Read a few pages today to maintain your streak.',
        },
        trigger: {
          hour,
          minute,
          repeats: true,
        },
      });
      return id;
    } catch (error) {
      logger.warn('Failed to schedule streak reminder', {
        message: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async scheduleAdhdSelfMonitor(intervalMinutes: number): Promise<string | null> {
    if (!(await this.initialize())) {
      return null;
    }
    try {
      return await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Focus check-in',
          body: "How's your focus right now?",
        },
        trigger: { seconds: intervalMinutes * 60, repeats: true },
      });
    } catch (error) {
      return null;
    }
  }

  async cancelNotification(id: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(id);
  }
}

export default new NotificationService();
