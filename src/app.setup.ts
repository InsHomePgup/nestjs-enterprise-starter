import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

/**
 * Applies every app-level setting (security headers, CORS, prefix, validation, error format).
 * Shared by `main.ts` and the e2e test bootstrap so tests exercise the real HTTP pipeline.
 */
export function configureApp(app: INestApplication): INestApplication {
  const configService = app.get(ConfigService);
  const logger = app.get(Logger);

  app.useLogger(logger);

  app.use(helmet());
  app.enableCors({ origin: configService.get<string>('app.corsOrigin') });
  app.setGlobalPrefix(configService.get<string>('app.apiPrefix') ?? 'api', {
    exclude: ['health'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter(logger));

  return app;
}

/** Mounts Swagger UI at `/docs` when `SWAGGER_ENABLED` is true. */
export function setupSwagger(app: INestApplication): void {
  const configService = app.get(ConfigService);
  if (!configService.get<boolean>('app.swaggerEnabled')) {
    return;
  }

  const swaggerConfig = new DocumentBuilder()
    .setTitle(configService.get<string>('app.name') ?? 'API')
    .setDescription(configService.get<string>('app.description') ?? '')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);
}
