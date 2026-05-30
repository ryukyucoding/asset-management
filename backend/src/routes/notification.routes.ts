import type { FastifyInstance } from 'fastify';
import { NotificationRepository } from '@infrastructure/repositories/notification.repository';
import { UserRepository } from '@infrastructure/repositories/user.repository';
import { CachedUserRepository } from '@infrastructure/repositories/cached-user.repository';
import { NotificationService } from '@services/notification/notification.service';
import { authMiddleware } from '@middleware/auth.middleware';
import { handleAppError } from '@domain/errors/app.errors';
import { getUnreadCount } from '@infrastructure/cache/unread-count.cache';

const notificationService = new NotificationService(
  new NotificationRepository(),
  new CachedUserRepository(new UserRepository()),
);

export async function notificationRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/notifications', { preHandler: [authMiddleware] }, async (request, reply) => {
    const notifications = await notificationService.listForUser(request.user.userId);
    return reply.send(notifications);
  });

  fastify.get('/notifications/unread-count', { preHandler: [authMiddleware] }, async (request, reply) => {
    const count = await getUnreadCount(request.user.userId);
    return reply.send({ count });
  });

  fastify.patch('/notifications/:id/read', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const notification = await notificationService.markAsRead(id, request.user.userId);
      return reply.send(notification);
    } catch (err) {
      const handled = handleAppError(err, reply);
      if (handled) return handled;
      throw err;
    }
  });

  fastify.patch('/notifications/read-all', { preHandler: [authMiddleware] }, async (request, reply) => {
    await notificationService.markAllAsRead(request.user.userId);
    return reply.status(204).send();
  });
}
