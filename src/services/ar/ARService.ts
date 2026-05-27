import { AROverlay } from '../../types';
import { GazePoint } from '../../types';
import { logger } from '../logger/Logger';

export type DyslexiaFilterColor = 'blue' | 'yellow' | 'none';

export interface DyslexiaFilterConfig {
  color: DyslexiaFilterColor;
  opacity: number;
  /** Full-screen overlay vs line-level strip */
  mode: 'overlay' | 'line-strip';
  lineHeight?: number;
}

const DYSLEXIA_FILTER_STYLES: Record<
  Exclude<DyslexiaFilterColor, 'none'>,
  { rgba: string; hex: string; description: string }
> = {
  blue: {
    rgba: 'rgba(33, 150, 243, 0.35)',
    hex: '#2196F3',
    description: 'Blue overlay — reduces visual stress for some dyslexic readers',
  },
  yellow: {
    rgba: 'rgba(255, 235, 59, 0.35)',
    hex: '#FFEB3B',
    description: 'Yellow overlay — improves contrast for some dyslexic readers',
  },
};

class ARService {
  private overlays: Map<string, AROverlay> = new Map();
  private isActive = false;
  private currentGaze?: GazePoint;
  private dyslexiaFilter: DyslexiaFilterConfig = {
    color: 'none',
    opacity: 0.35,
    mode: 'line-strip',
    lineHeight: 32,
  };

  activate(): void {
    this.isActive = true;
  }

  deactivate(): void {
    this.isActive = false;
    this.overlays.clear();
    this.setDyslexiaFilter('none');
  }

  updateGaze(gaze: GazePoint): void {
    this.currentGaze = gaze;
    this.updateOverlayPositions();
    this.updateLineStripPosition();
  }

  setDyslexiaFilter(color: DyslexiaFilterColor, options?: Partial<DyslexiaFilterConfig>): void {
    this.dyslexiaFilter = { ...this.dyslexiaFilter, color, ...options };
    this.syncDyslexiaOverlays();
    logger.debug('Dyslexia filter updated', { color: this.dyslexiaFilter.color });
  }

  getDyslexiaFilter(): DyslexiaFilterConfig {
    return { ...this.dyslexiaFilter };
  }

  toggleDyslexiaFilter(color: 'blue' | 'yellow'): void {
    if (this.dyslexiaFilter.color === color) {
      this.setDyslexiaFilter('none');
    } else {
      this.setDyslexiaFilter(color);
    }
  }

  private syncDyslexiaOverlays(): void {
    Array.from(this.overlays.keys())
      .filter((id) => id.startsWith('dyslexia-filter-'))
      .forEach((id) => this.overlays.delete(id));

    if (this.dyslexiaFilter.color === 'none' || !this.isActive) {
      return;
    }

    const style = DYSLEXIA_FILTER_STYLES[this.dyslexiaFilter.color];
    const baseY = this.currentGaze?.y ?? 200;

    if (this.dyslexiaFilter.mode === 'overlay') {
      this.addOverlay({
        id: 'dyslexia-filter-full',
        type: 'filter',
        position: { x: 0, y: 0 },
        content: { color: this.dyslexiaFilter.color, rgba: style.rgba, mode: 'overlay' },
        visible: true,
      });
    } else {
      this.addOverlay({
        id: 'dyslexia-filter-line',
        type: 'filter',
        position: { x: 0, y: baseY },
        content: {
          color: this.dyslexiaFilter.color,
          rgba: style.rgba,
          mode: 'line-strip',
          lineHeight: this.dyslexiaFilter.lineHeight ?? 32,
        },
        visible: true,
      });
    }
  }

  private updateLineStripPosition(): void {
    const lineOverlay = this.overlays.get('dyslexia-filter-line');
    if (lineOverlay && this.currentGaze) {
      lineOverlay.position = { x: 0, y: this.currentGaze.y - (this.dyslexiaFilter.lineHeight ?? 32) / 2 };
    }
  }

  addOverlay(overlay: AROverlay): void {
    this.overlays.set(overlay.id, overlay);
  }

  removeOverlay(id: string): void {
    this.overlays.delete(id);
  }

  getOverlaysAtGaze(): AROverlay[] {
    if (!this.currentGaze || !this.isActive) {
      return [];
    }

    const threshold = 100;
    return Array.from(this.overlays.values()).filter((overlay) => {
      if (overlay.id.startsWith('dyslexia-filter-')) {
        return overlay.visible;
      }
      const distance = Math.sqrt(
        (overlay.position.x - this.currentGaze!.x) ** 2 +
          (overlay.position.y - this.currentGaze!.y) ** 2
      );
      return distance < threshold;
    });
  }

  private updateOverlayPositions(): void {
    if (!this.currentGaze) {
      return;
    }

    this.overlays.forEach((overlay) => {
      if (overlay.type === 'definition' || overlay.type === 'animation') {
        overlay.position = {
          x: this.currentGaze!.x + 20,
          y: this.currentGaze!.y - 50,
        };
      }
    });
  }

  createDefinitionOverlay(
    word: string,
    definition: string,
    position: { x: number; y: number }
  ): AROverlay {
    const overlay: AROverlay = {
      id: `def-${word}-${Date.now()}`,
      type: 'definition',
      position,
      content: definition,
      visible: true,
    };
    this.addOverlay(overlay);
    return overlay;
  }

  createColorFilter(
    color: 'blue' | 'yellow',
    position: { x: number; y: number; z?: number }
  ): AROverlay {
    this.setDyslexiaFilter(color);
    const overlay: AROverlay = {
      id: `filter-${color}-${Date.now()}`,
      type: 'filter',
      position,
      content: color,
      visible: true,
    };
    this.addOverlay(overlay);
    return overlay;
  }

  getAllOverlays(): AROverlay[] {
    return Array.from(this.overlays.values()).filter((o) => o.visible);
  }

  isARActive(): boolean {
    return this.isActive;
  }

  getFilterStyleDescription(color: 'blue' | 'yellow'): string {
    return DYSLEXIA_FILTER_STYLES[color].description;
  }
}

export default new ARService();
