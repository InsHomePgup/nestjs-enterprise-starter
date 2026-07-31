import { INestApplication } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { HealthController } from '../src/modules/health/health.controller';
import { PrismaHealthIndicator } from '../src/modules/health/indicators/prisma-health.indicator';
import { RedisHealthIndicator } from '../src/modules/health/indicators/redis-health.indicator';

describe('HealthController (e2e)', () => {
  let app: INestApplication<App>;
  const prismaIndicator = { isHealthy: jest.fn() };
  const redisIndicator = { isHealthy: jest.fn() };

  beforeEach(async () => {
    prismaIndicator.isHealthy.mockResolvedValue({
      database: { status: 'up' },
    });
    redisIndicator.isHealthy.mockResolvedValue({ redis: { status: 'up' } });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TerminusModule],
      controllers: [HealthController],
      providers: [
        { provide: PrismaHealthIndicator, useValue: prismaIndicator },
        { provide: RedisHealthIndicator, useValue: redisIndicator },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/health (GET) returns ok when all dependencies are up', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({
          status: 'ok',
          info: {
            database: { status: 'up' },
            redis: { status: 'up' },
          },
        });
      });
  });

  it('/health (GET) returns 503 when a dependency is down', async () => {
    redisIndicator.isHealthy.mockResolvedValue({
      redis: { status: 'down', message: 'connection refused' },
    });

    await request(app.getHttpServer())
      .get('/health')
      .expect(503)
      .expect((res) => {
        expect(res.body).toMatchObject({
          status: 'error',
          error: {
            redis: { status: 'down' },
          },
        });
      });
  });
});
