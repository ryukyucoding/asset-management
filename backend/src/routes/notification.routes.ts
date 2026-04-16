import type { FastifyInstance } from 'fastify';
import { NotificationRepository } from '@infrastructure/repositories/notification.repository';
import { authMiddleware } from '@middleware/auth.middleware';

const notificationRepo = new NotificationRepository();

export async function notificationRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/notifications', { preHandler: [authMiddleware] }, async (request, reply) => {
    const notifications = await notificationRepo.findByUserId(request.user.userId);
    return reply.send(notifications);
  });

  fastify.patch('/notifications/:id/read', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const notification = await notificationRepo.markAsRead(id);
    return reply.send(notification);
  });

  fastify.patch('/notifications/read-all', { preHandler: [authMiddleware] }, async (request, reply) => {
    await notificationRepo.markAllAsRead(request.user.userId);
    return reply.status(204).send();
  });
}
