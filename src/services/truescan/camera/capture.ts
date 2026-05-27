import * as Camera from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

export interface CaptureOptions {
  quality?: number; // 0-1
  autoFocus?: boolean;
  flashMode?: 'on' | 'off' | 'auto';
}

export interface CapturedPage {
  uri: string;
  width: number;
  height: number;
  timestamp: number;
  pageIndex: number;
}

class CameraCaptureService {
  private cameraRef: Camera.CameraView | null = null;
  private capturedPages: CapturedPage[] = [];

  // Set camera reference
  setCameraRef(ref: Camera.CameraView | null) {
    this.cameraRef = ref;
  }

  // Capture single page
  async capturePage(options: CaptureOptions = {}): Promise<CapturedPage | null> {
    if (!this.cameraRef) {
      throw new Error('Camera not initialized');
    }

    try {
      // Request camera permissions
      const { status } = await Camera.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Camera permission denied');
      }

      // Take picture
      const photo = await this.cameraRef.takePictureAsync({
        quality: options.quality || 0.9,
        base64: false,
        skipProcessing: false,
      });

      if (!photo) {
        return null;
      }

      // Save to app directory
      const fileName = `truescan_${Date.now()}_${this.capturedPages.length}.jpg`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      
      // Copy to app directory
      await FileSystem.copyAsync({
        from: photo.uri,
        to: fileUri,
      });

      const capturedPage: CapturedPage = {
        uri: fileUri,
        width: photo.width,
        height: photo.height,
        timestamp: Date.now(),
        pageIndex: this.capturedPages.length,
      };

      this.capturedPages.push(capturedPage);
      return capturedPage;
    } catch (error) {
      console.error('Error capturing page:', error);
      return null;
    }
  }

  // Capture multiple pages
  async captureMultiplePages(count: number, options: CaptureOptions = {}): Promise<CapturedPage[]> {
    const pages: CapturedPage[] = [];

    for (let i = 0; i < count; i++) {
      const page = await this.capturePage(options);
      if (page) {
        pages.push(page);
      }
    }

    return pages;
  }

  // Get all captured pages
  getCapturedPages(): CapturedPage[] {
    return [...this.capturedPages];
  }

  // Clear captured pages
  clearCapturedPages() {
    this.capturedPages = [];
  }

  // Remove specific page
  async removePage(pageIndex: number) {
    const page = this.capturedPages[pageIndex];
    if (page) {
      try {
        await FileSystem.deleteAsync(page.uri, { idempotent: true });
      } catch (error) {
        console.error('Error deleting page:', error);
      }
      this.capturedPages.splice(pageIndex, 1);
      // Reindex
      this.capturedPages.forEach((p, i) => {
        p.pageIndex = i;
      });
    }
  }

  // Reorder pages
  reorderPages(fromIndex: number, toIndex: number) {
    const [removed] = this.capturedPages.splice(fromIndex, 1);
    this.capturedPages.splice(toIndex, 0, removed);
    // Reindex
    this.capturedPages.forEach((p, i) => {
      p.pageIndex = i;
    });
  }
}

export default new CameraCaptureService();
















