import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { bootstrapTestApp } from './utils/bootstrap-app';

/** Error codes as seen by a real client going through the full HTTP pipeline. */
describe('Error codes (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;

  beforeAll(async () => {
    app = await bootstrapTestApp();
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();

  it('COMMON_ROUTE_NOT_FOUND for an unknown endpoint', async () => {
    const res = await request(server()).get('/api/does-not-exist').expect(404);
    expect(res.body).toMatchObject({ code: 'COMMON_ROUTE_NOT_FOUND', error: 'Not Found' });
  });

  it('COMMON_MALFORMED_JSON for an unparsable body', async () => {
    const res = await request(server())
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ')
      .expect(400);
    expect(res.body.code).toBe('COMMON_MALFORMED_JSON');
  });

  it('COMMON_PAYLOAD_TOO_LARGE for an oversized body', async () => {
    const res = await request(server())
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'a@b.co', password: 'x'.repeat(200_000) }))
      .expect(413);
    expect(res.body.code).toBe('COMMON_PAYLOAD_TOO_LARGE');
  });

  it('AUTH_TOKEN_MISSING when no bearer token is sent', async () => {
    const res = await request(server()).get('/api/auth/me').expect(401);
    expect(res.body.code).toBe('AUTH_TOKEN_MISSING');
  });

  it('AUTH_TOKEN_INVALID for a malformed / forged token', async () => {
    const res = await request(server())
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not.a.jwt')
      .expect(401);
    expect(res.body.code).toBe('AUTH_TOKEN_INVALID');
  });

  it('AUTH_TOKEN_EXPIRED for an expired token', async () => {
    const expired = jwt.sign(
      { sub: '00000000-0000-0000-0000-000000000000', email: 'x@y.z', role: 'USER' },
      { expiresIn: -10 },
    );
    const res = await request(server())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expired}`)
      .expect(401);
    expect(res.body.code).toBe('AUTH_TOKEN_EXPIRED');
  });

  it('AUTH_RESET_TOKEN_INVALID for an unknown reset token', async () => {
    const res = await request(server())
      .post('/api/auth/reset-password')
      .send({ token: 'nope', newPassword: 'new-password123' })
      .expect(401);
    expect(res.body.code).toBe('AUTH_RESET_TOKEN_INVALID');
  });

  it('AUTH_INVALID_CREDENTIALS uses the registry message', async () => {
    const res = await request(server())
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever123' })
      .expect(401);
    expect(res.body).toMatchObject({
      code: 'AUTH_INVALID_CREDENTIALS',
      message: 'Invalid email or password',
    });
  });
});
