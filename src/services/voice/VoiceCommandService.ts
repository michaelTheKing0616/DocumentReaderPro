import { Platform } from 'react-native';
import { logger } from '../logger/Logger';

export type VoiceCommand =
  | 'pause-tts'
  | 'resume-tts'
  | 'next-page'
  | 'previous-page'
  | 'toggle-eye-tracking'
  | 'focus-mode';

type CommandListener = (command: VoiceCommand, transcript: string) => void;

interface SpeechRecognitionEventLike {
  results: ArrayLike<{ 0: { transcript: string } }>;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

const COMMAND_PATTERNS: Array<{ command: VoiceCommand; patterns: RegExp[] }> = [
  { command: 'pause-tts', patterns: [/pause\s+(the\s+)?(reading|tts|speech)/i, /stop\s+reading/i] },
  { command: 'resume-tts', patterns: [/resume\s+(the\s+)?(reading|tts|speech)/i, /continue\s+reading/i] },
  { command: 'next-page', patterns: [/next\s+page/i, /go\s+forward/i, /turn\s+page/i] },
  { command: 'previous-page', patterns: [/previous\s+page/i, /go\s+back/i, /last\s+page/i] },
  {
    command: 'toggle-eye-tracking',
    patterns: [/toggle\s+eye\s+track/i, /(turn|switch)\s+(on|off)\s+eye/i],
  },
  { command: 'focus-mode', patterns: [/focus\s+mode/i, /distraction\s+free/i, /hide\s+toolbar/i] },
];

class VoiceCommandService {
  private listening = false;
  private enabled = false;
  private recognition: SpeechRecognitionLike | null = null;
  private listeners = new Set<CommandListener>();
  private restartTimer: ReturnType<typeof setTimeout> | null = null;

  isSupported(): boolean {
    if (Platform.OS === 'web') {
      return this.getWebSpeechRecognition() != null;
    }
    return false;
  }

  addListener(listener: CommandListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) {
      return false;
    }

    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.mediaDevices) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        return true;
      }
    } catch (error) {
      logger.warn('VoiceCommandService microphone permission denied', { error: String(error) });
      return false;
    }

    return this.isSupported();
  }

  async start(enabled = true): Promise<void> {
    this.enabled = enabled;
    if (!enabled || this.listening) {
      return;
    }

    const SpeechRecognitionCtor = this.getWebSpeechRecognition();
    if (!SpeechRecognitionCtor) {
      logger.debug('VoiceCommandService: speech recognition unavailable on this platform');
      return;
    }

    const granted = await this.requestPermission();
    if (!granted) {
      return;
    }

    this.recognition = new SpeechRecognitionCtor();
    this.recognition.continuous = true;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      const transcript = last?.[0]?.transcript?.trim() ?? '';
      if (transcript) {
        this.dispatchTranscript(transcript);
      }
    };

    this.recognition.onerror = (event) => {
      logger.warn('VoiceCommandService recognition error', { error: event.error });
    };

    this.recognition.onend = () => {
      this.listening = false;
      if (this.enabled) {
        this.restartTimer = setTimeout(() => void this.start(true), 400);
      }
    };

    try {
      this.recognition.start();
      this.listening = true;
      logger.debug('VoiceCommandService listening');
    } catch (error) {
      logger.warn('VoiceCommandService failed to start', { error: String(error) });
    }
  }

  stop(): void {
    this.enabled = false;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // ignore
      }
      this.recognition = null;
    }
    this.listening = false;
  }

  parseCommand(text: string): VoiceCommand | null {
    const normalized = text.toLowerCase().trim();
    for (const entry of COMMAND_PATTERNS) {
      if (entry.patterns.some((pattern) => pattern.test(normalized))) {
        return entry.command;
      }
    }
    return null;
  }

  dispatchTranscript(transcript: string): void {
    const command = this.parseCommand(transcript);
    if (!command) {
      return;
    }
    logger.debug('VoiceCommandService command', { command, transcript });
    this.listeners.forEach((listener) => listener(command, transcript));
  }

  private getWebSpeechRecognition():
    | (new () => SpeechRecognitionLike)
    | null {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return null;
    }
    const win = window as typeof window & {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
  }
}

export default new VoiceCommandService();
