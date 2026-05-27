import { useState, useEffect, useCallback } from 'react';
import VoiceCommandService, { VoiceCommand } from '../services/voice/VoiceCommandService';

export type { VoiceCommand };

export const useVoiceCommands = (enabled: boolean, onCommand?: (command: VoiceCommand) => void) => {
  const [isListening, setIsListening] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    const requestPermission = async () => {
      if (!VoiceCommandService.isSupported()) {
        setHasPermission(false);
        return;
      }
      const granted = await VoiceCommandService.requestPermission();
      setHasPermission(granted);
    };
    void requestPermission();
  }, []);

  useEffect(() => {
    if (!onCommand) {
      return;
    }
    return VoiceCommandService.addListener((command) => onCommand(command));
  }, [onCommand]);

  const startListening = useCallback(async () => {
    if (!enabled || !hasPermission) return;
    await VoiceCommandService.start(true);
    setIsListening(true);
  }, [enabled, hasPermission]);

  const stopListening = useCallback(() => {
    VoiceCommandService.stop();
    setIsListening(false);
  }, []);

  const processCommand = useCallback(
    (text: string) => {
      const command = VoiceCommandService.parseCommand(text);
      if (command && onCommand) {
        onCommand(command);
      }
    },
    [onCommand]
  );

  useEffect(() => {
    if (enabled && hasPermission) {
      void startListening();
    } else {
      stopListening();
    }
  }, [enabled, hasPermission, startListening, stopListening]);

  return {
    isListening,
    hasPermission,
    isSupported: VoiceCommandService.isSupported(),
    startListening,
    stopListening,
    processCommand,
  };
};
