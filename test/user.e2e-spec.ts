import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { bootstrapTestApp } from './utils/bootstrap-app';

describe('User (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await bootstrapTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('enforces RBAC and supports admin CRUD over users', async () => {
    const email = `admin-${Date.now()}@example.com`;
    const server = app.getHttpServer();

    const registerRes = await request(server)
      .post('/api/auth/register')
      .send({ email, password: 'password123', name: 'Admin Candidate' })
      .expect(201);
    const userId: string = registerRes.body.data.user.id;

    const listAsUserRes = await request(server)
      .get('/api/users')
      .set('Authorization', `Bearer ${registerRes.body.data.accessToken}`)
      .expect(403);
    expect(listAsUserRes.body.code).toBe('AUTH_FORBIDDEN');

    await prisma.user.update({ where: { id: userId }, data: { role: 'ADMIN' } });

    const loginRes = await request(server)
      .post('/api/auth/login')
      .send({ email, password: 'password123' })
      .expect(201);
    const accessToken: string = loginRes.body.data.accessToken;
    const auth = () => ({ Authorization: `Bearer ${accessToken}` });

    const listRes = await request(server).get('/api/users').set(auth()).expect(200);
    expect(listRes.body.data).toMatchObject({
      items: expect.any(Array),
      meta: { page: 1, limit: 20, total: expect.any(Number), totalPages: expect.any(Number) },
    });

    const detailRes = await request(server).get(`/api/users/${userId}`).set(auth()).expect(200);
    expect(detailRes.body.data).not.toHaveProperty('password');
    expect(detailRes.body.data.email).toBe(email);

    const patchRes = await request(server)
      .patch(`/api/users/${userId}`)
      .set(auth())
      .send({ name: 'Renamed Admin' })
      .expect(200);
    expect(patchRes.body.data.name).toBe('Renamed Admin');

    await request(server).delete(`/api/users/${userId}`).set(auth()).expect(200);
    await request(server).get(`/api/users/${userId}`).set(auth()).expect(404);
  });
});
