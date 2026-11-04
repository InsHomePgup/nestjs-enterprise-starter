import { Global, Module, RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { type HttpLogger, pinoHttp } from 'pino-http';
import { buildPinoHttpOptions } from './logger.options';

/** The single pino-http instance: access log for every request + root logger for the app. */
export const HTTP_LOGGER = Symbol('HTTP_LOGGER');

@Global()
@Module({
  providers: [
    {
      provide: HTTP_LOGGER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): HttpLogger =>
        pinoHttp(
          buildPinoHttpOptions({
            level: config.get<string>('app.logLevel') ?? 'info',
            nodeEnv: config.get<string>('app.nodeEnv') ?? 'development',
          }),
        ),
    },
  ],
  exports: [HTTP_LOGGER],
})
class HttpLoggerModule {}

/**
 * Logging setup.
 *
 * The access-log middleware (HTTP_LOGGER) is mounted by `configureApp` as one of the very
 * first Express middlewares, so EVERY request is logged exactly once — including ones that
 * fail before reaching Nest's router (malformed JSON, unknown routes, /health, /api root).
 *
 * nestjs-pino runs in `useExisting` mode on top of that same instance: it does not create a
 * second pino-http, it only binds `req.log` so `Logger` / `PinoLogger` calls made while
 * handling a request carry the request context.
 */
@Module({
  imports: [
    HttpLoggerModule,
    LoggerModule.forRootAsync({
      imports: [HttpLoggerModule],
      inject: [HTTP_LOGGER],
      useFactory: (httpLogger: HttpLogger) => ({
        pinoHttp: { logger: httpLogger.logger },
        useExisting: true,
        forRoutes: [{ path: '/{*splat}', method: RequestMethod.ALL }],
      }),
    }),
  ],
})
export class AppLoggerModule {}
