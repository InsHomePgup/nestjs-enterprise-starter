import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { ClsMiddleware } from 'nestjs-cls';
import { Logger } from 'nestjs-pino';
import type { HttpLogger } from 'pino-http';
import { type RequestWithId, requestIdMiddleware } from './common/context/request-id.middleware';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { createJsonBodyParser } from './common/http/json-body-parser';
import { buildOpenApiDocument } from './common/swagger/openapi';
import { validationExceptionFactory } from './common/validation/validation-exception.factory';
import { HTTP_LOGGER } from './infra/logger/logger.module';

/** `/api` prefix for business routes; `/health` stays at the root for probes. */
export function applyGlobalPrefix(app: INestApplication): void {
  const prefix = app.get(ConfigService).get<string>('app.apiPrefix') ?? 'api';
  app.setGlobalPrefix(prefix, { exclude: ['health'] });
}

/**
 * Applies every app-level setting (security headers, CORS, prefix, validation, error format).
 * Shared by `main.ts` and the e2e test bootstrap so tests exercise the real HTTP pipeline.
 */
export function configureApp(app: INestApplication): INestApplication {
  const configService = app.get(ConfigService);
  const logger = app.get(Logger);

  app.useLogger(logger);

  // Order matters — these run before anything else, for every request:
  // 1. request ID (read by logs, request context and error bodies)
  app.use(requestIdMiddleware);
  // 2. request context, so the access log below can still read userId when the response ends
  app.use(
    new ClsMiddleware({ generateId: true, idGenerator: (req: RequestWithId) => req.id ?? '' }).use,
  );
  // 3. access log: one line per request, even if it fails before reaching a controller
  app.use(app.get<HttpLogger>(HTTP_LOGGER));
  app.use(helmet());
  // Runs before Nest's built-in parser so malformed / oversized bodies get precise error codes.
  app.use(createJsonBodyParser(configService.get<string>('app.bodyLimit')));
  app.enableCors({ origin: configService.get<string>('app.corsOrigin') });
  applyGlobalPrefix(app);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      // Field-level `details: [{ field, rule, message }]` instead of a flat string array.
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  return app;
}

/** Mounts Swagger UI at `/docs` (and the raw JSON at `/docs-json`) when SWAGGER_ENABLED is true. */
export function setupSwagger(app: INestApplication): void {
  const configService = app.get(ConfigService);
  if (!configService.get<boolean>('app.swaggerEnabled')) {
    return;
  }
  SwaggerModule.setup('docs', app, () => buildOpenApiDocument(app), {
    jsonDocumentUrl: 'docs-json',
  });
}
