import { Writable } from 'node:stream';
import pino from 'pino';
import { buildPinoHttpOptions, REDACT_CENSOR } from './logger.options';

function captureLogger() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      lines.push(chunk.toString());
      cb();
    },
  });
  const { redact, serializers } = buildPinoHttpOptions({ level: 'info', nodeEnv: 'test' });
  const logger = pino({ redact, serializers }, stream);
  return { logger, output: () => lines.join('') };
}

describe('logger options', () => {
  it('redacts credentials in request headers', () => {
    const { logger, output } = captureLogger();
    logger.info({
      req: { headers: { authorization: 'Bearer secret-jwt', cookie: 'sid=secret-cookie' } },
    });
    expect(output()).not.toContain('secret-jwt');
    expect(output()).not.toContain('secret-cookie');
    expect(output()).toContain(REDACT_CENSOR);
  });

  it('redacts secrets in logged payloads, top-level and one level deep', () => {
    const { logger, output } = captureLogger();
    logger.info({ password: 'p1', dto: { password: 'p2', refreshToken: 'r1', email: 'a@b.c' } });
    expect(output()).not.toMatch(/p1|p2|r1/);
    expect(output()).toContain('a@b.c');
  });

  it('logs only the status code of the response', () => {
    const { logger, output } = captureLogger();
    logger.info({ res: { statusCode: 200, headers: { 'content-security-policy': 'noise' } } });
    expect(output()).toContain('"statusCode":200');
    expect(output()).not.toContain('noise');
  });

  it('maps status codes to log levels', () => {
    const { customLogLevel } = buildPinoHttpOptions({ level: 'info', nodeEnv: 'test' });
    const level = (statusCode: number) =>
      customLogLevel?.({} as never, { statusCode } as never, undefined);
    expect(level(200)).toBe('info');
    expect(level(404)).toBe('warn');
    expect(level(500)).toBe('error');
  });
});
