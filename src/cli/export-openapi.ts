import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';

/**
 * Writes the OpenAPI contract to ./openapi.json without starting the server or touching
 * the database / Redis (no connections are opened before app.init()).
 *
 * Must run from the compiled output so the Swagger CLI plugin has been applied:
 *   pnpm openapi:export   (= nest build && node dist/src/cli/export-openapi.js)
 */
async function main() {
  // Config validation requires these; their values are irrelevant for generating the docs.
  process.env.DATABASE_URL ??= 'postgresql://openapi:openapi@localhost:5432/openapi';
  process.env.REDIS_HOST ??= 'localhost';
  process.env.REDIS_PORT ??= '6379';
  process.env.JWT_SECRET ??= 'openapi-export-placeholder-secret';
  process.env.LOG_LEVEL = 'silent';

  // Loaded after the env defaults above, because ConfigModule validates at import time.
  // (require, not import(): with module=nodenext a dynamic import() stays a real ESM import.)
  const { AppModule } = require('../app.module') as typeof import('../app.module');
  const { applyGlobalPrefix } = require('../app.setup') as typeof import('../app.setup');
  const { buildOpenApiDocument } =
    require('../common/swagger/openapi') as typeof import('../common/swagger/openapi');

  const app = await NestFactory.create(AppModule, { logger: false });
  applyGlobalPrefix(app);
  const document = buildOpenApiDocument(app);

  const target = join(process.cwd(), 'openapi.json');
  writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`);
  console.log(`[openapi:export] v${document.info.version} -> ${target}`);
  await app.close();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
