import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'X-Request-Id';

/** Accept caller-supplied IDs only if they look like an ID (prevents log injection / huge values). */
const VALID_INCOMING_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export type RequestWithId = Request & { id?: string };

/**
 * Assigns a request ID before anything else runs, so that logs (pino), the request
 * context (CLS) and error responses all share the same value.
 *
 * - Reuses a well-formed incoming `X-Request-Id` (e.g. from a gateway or the frontend),
 *   otherwise generates a UUID.
 * - Echoes it back in the `X-Request-Id` response header so clients can quote it in bug reports.
 */
export function requestIdMiddleware(req: RequestWithId, res: Response, next: NextFunction): void {
  const incoming = req.headers[REQUEST_ID_HEADER.toLowerCase()];
  const candidate = Array.isArray(incoming) ? incoming[0] : incoming;
  const id = candidate && VALID_INCOMING_ID.test(candidate) ? candidate : randomUUID();

  req.id = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
}
