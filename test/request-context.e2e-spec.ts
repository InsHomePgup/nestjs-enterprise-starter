import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { bootstrapTestApp } from './utils/bootstrap-app';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('Request ID (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await bootstrapTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reuses a well-formed incoming X-Request-Id and echoes it in body and header', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/users')
      .set('X-Request-Id', 'trace-abc_123')
      .expect(401);
    expect(res.headers['x-request-id']).toBe('trace-abc_123');
    expect(res.body.requestId).toBe('trace-abc_123');
  });

  it('replaces a malformed incoming X-Request-Id with a generated UUID', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/users')
      .set('X-Request-Id', 'bad id <script>')
      .expect(401);
    expect(res.headers['x-request-id']).toMatch(UUID);
    expect(res.body.requestId).toBe(res.headers['x-request-id']);
  });

  it('generates a request ID when none is supplied, also on success responses', async () => {
    const res = await request(app.getHttpServer()).get('/api').expect(200);
    expect(res.headers['x-request-id']).toMatch(UUID);
    expect(res.body.requestId).toBe(res.headers['x-request-id']);
  });
});
