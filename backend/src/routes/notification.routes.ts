import type { FastifyInstance } from 'fastify';
import { NotificationRepository } from '@infrastructure/repositories/notification.repository';
import { UserRepository } from '@infrastructure/repositories/user.repository';
import { NotificationService } from '@services/notification/notification.service';
import { authMiddleware } from '@middleware/auth.middleware';

const notificationService = new NotificationService(new NotificationRepository(), new UserRepository());

export async function notificationRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/notifications', { preHandler: [authMiddleware] }, async (request, reply) => {
    const notifications = await notificationService.listForUser(request.user.userId);
    return reply.send(notifications);
  });

  fastify.patch('/notifications/:id/read', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const notification = await notificationService.markAsRead(id);
    return reply.send(notification);
  });

  fastify.patch('/notifications/read-all', { preHandler: [authMiddleware] }, async (request, reply) => {
    await notificationService.markAllAsRead(request.user.userId);
    return reply.status(204).send();
  });
}
