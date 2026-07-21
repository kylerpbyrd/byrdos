import pino, { type Logger, type LoggerOptions } from 'pino';

export function createLogger(name: string): Logger {
  const level = process.env.LOG_LEVEL || 'info';
  const isProduction = process.env.NODE_ENV === 'production';

  const options: LoggerOptions = {
    level,
    base: { name },
    redact: {
      paths: [
        'password',
        '*.password',
        'token',
        '*.token',
        'accessToken',
        '*.accessToken',
        'cipher',
        '*.cipher',
        'secret',
        '*.secret',
      ],
      censor: '[REDACTED]',
    },
  };

  if (!isProduction) {
    return pino(options, pino.transport({ target: 'pino-pretty' }));
  }

  return pino(options);
}
