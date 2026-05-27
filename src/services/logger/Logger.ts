type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogPayload {
  [key: string]: unknown;
}

function formatMessage(level: LogLevel, message: string, payload?: LogPayload): string {
  const base = `[ReadAssist:${level}] ${message}`;
  if (!payload || Object.keys(payload).length === 0) {
    return base;
  }
  return `${base} ${JSON.stringify(payload)}`;
}

function sendToSentry(level: LogLevel, message: string, payload?: LogPayload): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    return;
  }
  // Scaffold: wire @sentry/react-native when installed
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.debug('[Sentry scaffold]', level, message, payload);
  }
}

function sendToPostHog(event: string, properties?: LogPayload): void {
  const key = process.env.EXPO_PUBLIC_POSTHOG_KEY;
  if (!key) {
    return;
  }
  // Scaffold: wire posthog-react-native when installed
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.debug('[PostHog scaffold]', event, properties);
  }
}

export const logger = {
  debug(message: string, payload?: LogPayload): void {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.debug(formatMessage('debug', message, payload));
    }
  },
  info(message: string, payload?: LogPayload): void {
    // eslint-disable-next-line no-console
    console.info(formatMessage('info', message, payload));
    sendToPostHog('log_info', { message, ...payload });
  },
  warn(message: string, payload?: LogPayload): void {
    // eslint-disable-next-line no-console
    console.warn(formatMessage('warn', message, payload));
    sendToSentry('warn', message, payload);
  },
  error(message: string, payload?: LogPayload): void {
    // eslint-disable-next-line no-console
    console.error(formatMessage('error', message, payload));
    sendToSentry('error', message, payload);
    sendToPostHog('log_error', { message, ...payload });
  },
  track(event: string, properties?: LogPayload): void {
    sendToPostHog(event, properties);
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.debug(formatMessage('debug', `Track: ${event}`, properties));
    }
  },
};
