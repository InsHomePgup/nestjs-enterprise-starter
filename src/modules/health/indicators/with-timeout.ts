/** Max time a single dependency check may take before it is reported as down. */
export const HEALTH_CHECK_TIMEOUT_MS = 2000;

/**
 * Rejects if `work` does not settle within `ms`. Health checks must fail fast: a client that
 * keeps reconnecting (e.g. Redis with an unresolvable host) would otherwise hang the probe
 * forever instead of reporting the dependency as down.
 */
export function withTimeout<T>(work: Promise<T>, ms = HEALTH_CHECK_TIMEOUT_MS): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}
