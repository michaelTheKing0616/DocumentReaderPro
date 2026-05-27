import * as Font from 'expo-font';
import { logger } from '../logger/Logger';

export const FONT_FAMILIES = {
  OPEN_DYSLEXIC_REGULAR: 'OpenDyslexic-Regular',
  OPEN_DYSLEXIC_BOLD: 'OpenDyslexic-Bold',
} as const;

const FONT_ASSETS = {
  [FONT_FAMILIES.OPEN_DYSLEXIC_REGULAR]: require('../../../assets/fonts/OpenDyslexic-Regular.otf'),
  [FONT_FAMILIES.OPEN_DYSLEXIC_BOLD]: require('../../../assets/fonts/OpenDyslexic-Bold.otf'),
} as const;

class FontLoaderService {
  private loaded = false;
  private loadPromise: Promise<void> | null = null;

  async load(): Promise<void> {
    if (this.loaded) {
      return;
    }

    if (!this.loadPromise) {
      this.loadPromise = this.loadInternal();
    }

    return this.loadPromise;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  getOpenDyslexicRegularFamily(): string {
    return FONT_FAMILIES.OPEN_DYSLEXIC_REGULAR;
  }

  getOpenDyslexicBoldFamily(): string {
    return FONT_FAMILIES.OPEN_DYSLEXIC_BOLD;
  }

  private async loadInternal(): Promise<void> {
    try {
      await Font.loadAsync(FONT_ASSETS);
      this.loaded = true;
      logger.info('FontLoader ready', { families: Object.keys(FONT_ASSETS) });
    } catch (error) {
      this.loadPromise = null;
      logger.error('FontLoader failed', { error: String(error) });
      throw error;
    }
  }
}

export default new FontLoaderService();
