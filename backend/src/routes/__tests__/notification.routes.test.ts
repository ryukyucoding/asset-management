import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { signAccessToken } from '@services/auth/auth.service';

const serviceMocks = vi.hoisted(() => ({
  listForUser:   vi.fn(),
  markAsRead:    vi.fn(),
  markAllAsRead: vi.fn(),
}));

vi.mock('@services/notification/notification.service', () => ({
  NotificationService: vi.fn().mockImplementation(() => serviceMocks),
}));

import { notificationRoutes } from '../notification.routes';

const userToken = signAccessToken({ userId: 'user-1', role: 'USER' });

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(notificationRoutes);
  await app.ready();
  return app;
}

describe('GET /notifications', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  afterEach(() => app.close());

  it('401 — unauthenticated', async () => {
    const res = await app.inject({ method: 'GET', url: '/notifications' });
    expect(res.statusCode).toBe(401);
  });

  it('200 — returns user notifications', async () => {
    serviceMocks.listForUser.mockResolvedValue([
      { id: 'n-1', userId: 'user-1', type: 'TEST', message: 'Hello', isRead: false, createdAt: new Date() },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/notifications',
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(res.statusCode).toBe(200);
    expect(serviceMocks.listForUser).toHaveBeenCalledWith('user-1');
  });
});

describe('PATCH /notifications/:id/read', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  afterEach(() => app.close());

  it('200 — marks notification as read', async () => {
    serviceMocks.markAsRead.mockResolvedValue({
      id: 'n-1', userId: 'user-1', type: 'TEST', message: 'Hello', isRead: true, createdAt: new Date(),
    });

    const res = await app.inject({
      method: 'PATCH',
      url: '/notifications/n-1/read',
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(res.statusCode).toBe(200);
    expect(serviceMocks.markAsRead).toHaveBeenCalledWith('n-1', 'user-1');
  });
});

describe('PATCH /notifications/read-all', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  afterEach(() => app.close());

  it('204 — marks all notifications as read', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/notifications/read-all',
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(res.statusCode).toBe(204);
    expect(serviceMocks.markAllAsRead).toHaveBeenCalledWith('user-1');
  });
});
