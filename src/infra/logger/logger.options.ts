import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Options } from 'pino-http';
import { getRequestContext } from '../../common/context/request-context';
import type { RequestWithId } from '../../common/context/request-id.middleware';

export const REDACT_CENSOR = '[REDACTED]';

/**
 * Log paths whose values must never be written out in clear text.
 * `*.x` matches key `x` one level deep in any logged object (e.g. `logger.info({ dto })`).
 * Extend this list whenever you log a new kind of secret.
 */
export const REDACT_PATHS = [
  // credentials carried in HTTP headers
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',
  // secrets that might appear in logged payloads
  'password',
  'newPassword',
  'token',
  'accessToken',
  'refreshToken',
  '*.password',
  '*.newPassword',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
];

/** Set by AllExceptionsFilter so the access log line carries the business error code. */
export const ERROR_CODE_LOCAL = 'errorCode';

type ResponseWithLocals = ServerResponse & { locals?: Record<string, unknown> };

function describe(req: IncomingMessage, res: ServerResponse, responseTime?: number): string {
  const ms = responseTime === undefined ? '' : ` ${Math.round(responseTime)}ms`;
  return `${req.method} ${req.url} ${res.statusCode}${ms}`;
}

export interface LoggerConfig {
  level: string;
  nodeEnv: string;
}

export function buildPinoHttpOptions({ level, nodeEnv }: LoggerConfig): Options {
  return {
    level,
    // The ID is assigned by requestIdMiddleware, which runs before pino-http.
    genReqId: (req: IncomingMessage) => (req as RequestWithId).id ?? randomUUID(),
    redact: { paths: REDACT_PATHS, censor: REDACT_CENSOR },
    // One access-log line per request: 5xx -> error (with stack), 4xx -> warn, rest -> info.
    customLogLevel: (_req, res, error) => {
      if (error || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    customSuccessMessage: (req, res, responseTime) => describe(req, res, responseTime),
    customErrorMessage: (req, res) => describe(req, res),
    customProps: (_req, res) => {
      const errorCode = (res as ResponseWithLocals).locals?.[ERROR_CODE_LOCAL];
      return errorCode ? { errorCode } : {};
    },
    // Response headers (CSP etc.) are noise for troubleshooting; keep only the status.
    serializers: {
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
    // Every log line written while handling an authenticated request carries the user ID,
    // so `grep userId` / `grep reqId` finds everything a given user or request did.
    mixin: () => {
      const { userId } = getRequestContext();
      return userId ? { userId } : {};
    },
    transport:
      nodeEnv === 'development'
        ? { target: 'pino-pretty', options: { singleLine: true } }
        : undefined,
  };
}
