import { useState, useEffect, useCallback } from 'react';
import { AROverlay, GazePoint } from '../types';
import ARService from '../services/ar/ARService';

export const useAROverlays = (enabled: boolean) => {
  const [overlays, setOverlays] = useState<AROverlay[]>([]);
  const [isActive, setIsActive] = useState(false);

  // Activate AR
  const activate = useCallback(() => {
    ARService.activate();
    setIsActive(true);
  }, []);

  // Deactivate AR
  const deactivate = useCallback(() => {
    ARService.deactivate();
    setIsActive(false);
    setOverlays([]);
  }, []);

  // Update gaze for overlay positioning
  const updateGaze = useCallback((gaze: GazePoint) => {
    ARService.updateGaze(gaze);
    const activeOverlays = ARService.getOverlaysAtGaze();
    setOverlays(activeOverlays);
  }, []);

  // Add overlay
  const addOverlay = useCallback((overlay: AROverlay) => {
    ARService.addOverlay(overlay);
    setOverlays(ARService.getAllOverlays());
  }, []);

  // Remove overlay
  const removeOverlay = useCallback((id: string) => {
    ARService.removeOverlay(id);
    setOverlays(ARService.getAllOverlays());
  }, []);

  // Create definition overlay
  const createDefinition = useCallback((word: string, definition: string, position: { x: number; y: number }) => {
    const overlay = ARService.createDefinitionOverlay(word, definition, position);
    setOverlays(ARService.getAllOverlays());
    return overlay;
  }, []);

  // Create color filter
  const createColorFilter = useCallback((color: 'blue' | 'yellow', position: { x: number; y: number; z?: number }) => {
    const overlay = ARService.createColorFilter(color, position);
    setOverlays(ARService.getAllOverlays());
    return overlay;
  }, []);

  // Initialize
  useEffect(() => {
    if (enabled) {
      activate();
    } else {
      deactivate();
    }
  }, [enabled, activate, deactivate]);

  return {
    overlays,
    isActive,
    activate,
    deactivate,
    updateGaze,
    addOverlay,
    removeOverlay,
    createDefinition,
    createColorFilter,
  };
};

