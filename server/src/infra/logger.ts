// Minimal log adapter. All app logging goes through here so lint can ban
// direct console usage outside this file. Uses pino-style API surfaced
// through the server's own logger where possible.
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { singleLine: true } }
      : undefined,
});