import { INestApplication } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import request from 'supertest';
import { App } from 'supertest/types';
import { bootstrapTestApp } from './utils/bootstrap-app';

describe('Auth flows (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await bootstrapTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rotates refresh tokens and rejects reuse of a spent one', async () => {
    const email = `refresh-${Date.now()}@example.com`;
    const server = app.getHttpServer();

    const registerRes = await request(server)
      .post('/api/auth/register')
      .send({ email, password: 'password123' })
      .expect(201);
    const firstRefreshToken: string = registerRes.body.data.refreshToken;

    const refreshRes = await request(server)
      .post('/api/auth/refresh')
      .send({ refreshToken: firstRefreshToken })
      .expect(200);
    expect(refreshRes.body.data.refreshToken).not.toBe(firstRefreshToken);

    const reuseRes = await request(server)
      .post('/api/auth/refresh')
      .send({ refreshToken: firstRefreshToken })
      .expect(401);
    expect(reuseRes.body.code).toBe('AUTH_REFRESH_TOKEN_INVALID');
  });

  it('lets only one of several concurrent refreshes with the same token succeed', async () => {
    const email = `refresh-race-${Date.now()}@example.com`;
    const server = app.getHttpServer();

    const registerRes = await request(server)
      .post('/api/auth/register')
      .send({ email, password: 'password123' })
      .expect(201);
    const refreshToken: string = registerRes.body.data.refreshToken;

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(server).post('/api/auth/refresh').send({ refreshToken }),
      ),
    );
    const statuses = results.map((res) => res.status).sort();
    expect(statuses).toEqual([200, 401, 401, 401, 401]);
  });

  it('returns 409 AUTH_EMAIL_TAKEN for concurrent registrations of the same email', async () => {
    const email = `register-race-${Date.now()}@example.com`;
    const server = app.getHttpServer();

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(server).post('/api/auth/register').send({ email, password: 'password123' }),
      ),
    );
    const statuses = results.map((res) => res.status).sort();
    expect(statuses).toEqual([201, 409, 409, 409, 409]);
    for (const res of results.filter((r) => r.status === 409)) {
      expect(res.body.code).toBe('AUTH_EMAIL_TAKEN');
    }
  });

  it('returns validation errors as a flat message plus details', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'short' })
      .expect(400);
    expect(res.body).toMatchObject({
      statusCode: 400,
      code: 'COMMON_VALIDATION_FAILED',
      message: 'Validation failed',
      details: expect.arrayContaining([
        { field: 'email', rule: 'isEmail', message: expect.any(String) },
        { field: 'password', rule: 'minLength', message: expect.any(String) },
      ]),
    });
  });

  it('logs out by revoking the refresh token', async () => {
    const email = `logout-${Date.now()}@example.com`;
    const server = app.getHttpServer();

    const registerRes = await request(server)
      .post('/api/auth/register')
      .send({ email, password: 'password123' })
      .expect(201);
    const refreshToken: string = registerRes.body.data.refreshToken;

    await request(server).post('/api/auth/logout').send({ refreshToken }).expect(204);

    await request(server).post('/api/auth/refresh').send({ refreshToken }).expect(401);
  });

  it('resets the password end-to-end using the logged reset token', async () => {
    const email = `reset-${Date.now()}@example.com`;
    const server = app.getHttpServer();
    const logger = app.get(Logger);
    const debugSpy = jest.spyOn(logger, 'debug');

    await request(server)
      .post('/api/auth/register')
      .send({ email, password: 'password123' })
      .expect(201);

    await request(server).post('/api/auth/forgot-password').send({ email }).expect(204);

    const logCall = debugSpy.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].includes('Password reset token'),
    );
    if (!logCall) {
      throw new Error('Expected the reset token debug log to have been emitted');
    }
    const resetToken = (logCall[0] as string).split(': ').pop() as string;

    await request(server)
      .post('/api/auth/reset-password')
      .send({ token: resetToken, newPassword: 'brand-new-password123' })
      .expect(204);

    await request(server)
      .post('/api/auth/login')
      .send({ email, password: 'password123' })
      .expect(401);

    await request(server)
      .post('/api/auth/login')
      .send({ email, password: 'brand-new-password123' })
      .expect(200);

    debugSpy.mockRestore();
  });
});
