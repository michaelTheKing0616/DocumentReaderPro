import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../logger/Logger';

const KEY_PREFIX = '@readassist_secure_token:';

/**
 * Token storage abstraction. Uses AsyncStorage; swap to expo-secure-store in production builds.
 */
class SecureTokenStore {
  async setToken(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(`${KEY_PREFIX}${key}`, value);
    } catch (error) {
      logger.error('SecureTokenStore set failed', {
        key,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getToken(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(`${KEY_PREFIX}${key}`);
    } catch (error) {
      logger.warn('SecureTokenStore get failed', {
        key,
        message: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async removeToken(key: string): Promise<void> {
    await AsyncStorage.removeItem(`${KEY_PREFIX}${key}`);
  }

  async hasToken(key: string): Promise<boolean> {
    const value = await this.getToken(key);
    return Boolean(value);
  }
}

export default new SecureTokenStore();
