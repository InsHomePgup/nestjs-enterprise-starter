import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';

/** Boots the full AppModule with exactly the same HTTP pipeline as `main.ts`. */
export async function bootstrapTestApp(): Promise<INestApplication> {
  const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = configureApp(moduleFixture.createNestApplication());
  await app.init();
  return app;
}
