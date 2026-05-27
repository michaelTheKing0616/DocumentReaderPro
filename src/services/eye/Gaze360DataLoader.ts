import { logger } from '../logger/Logger';
import { isDevLabEnabled } from '../../utils/mockGate';

const GAZE360_MANIFEST_ENV = 'EXPO_PUBLIC_GAZE360_MANIFEST_URL';

export interface Gaze360Sample {
  imagePath: string;
  gazeVector: [number, number, number];
  headPose?: [number, number, number];
}

export interface Gaze360Batch {
  samples: Gaze360Sample[];
  totalCount: number;
}

/**
 * Dev-only loader for Gaze360-style manifests. Not invoked in production builds.
 */
export class Gaze360DataLoader {
  private cachedBatch: Gaze360Batch | null = null;

  isAvailable(): boolean {
    return isDevLabEnabled();
  }

  async loadBatch(limit = 32): Promise<Gaze360Batch | null> {
    if (!isDevLabEnabled()) {
      logger.warn('Gaze360DataLoader is dev-only');
      return null;
    }

    if (this.cachedBatch) {
      return this.cachedBatch;
    }

    const manifestUrl = process.env[GAZE360_MANIFEST_ENV];
    if (!manifestUrl) {
      logger.debug('Gaze360 manifest URL not configured; returning scaffold batch');
      this.cachedBatch = this.createScaffoldBatch(limit);
      return this.cachedBatch;
    }

    try {
      const response = await fetch(manifestUrl);
      if (!response.ok) {
        throw new Error(`Gaze360 manifest fetch failed: ${response.status}`);
      }

      const manifest = (await response.json()) as {
        samples?: Gaze360Sample[];
      };

      const samples = (manifest.samples ?? []).slice(0, limit);
      this.cachedBatch = {
        samples,
        totalCount: samples.length,
      };

      logger.info('Gaze360DataLoader batch loaded', { count: samples.length });
      return this.cachedBatch;
    } catch (error) {
      logger.error('Gaze360DataLoader failed', { error: String(error) });
      this.cachedBatch = this.createScaffoldBatch(limit);
      return this.cachedBatch;
    }
  }

  clearCache(): void {
    this.cachedBatch = null;
  }

  private createScaffoldBatch(limit: number): Gaze360Batch {
    const samples: Gaze360Sample[] = Array.from({ length: limit }, (_, index) => ({
      imagePath: `gaze360/scaffold/${index}.jpg`,
      gazeVector: [0, 0, 1],
      headPose: [0, 0, 0],
    }));

    return {
      samples,
      totalCount: samples.length,
    };
  }
}

export default new Gaze360DataLoader();
