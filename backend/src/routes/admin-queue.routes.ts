import type { FastifyInstance } from 'fastify';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { FastifyAdapter } from '@bull-board/fastify';
import { getNotificationQueue } from '@infrastructure/queue/notification.queue';
import { authMiddleware, requireRole } from '@middleware/auth.middleware';

const BOARD_PREFIX = '/admin/queue';

export async function adminQueueRoutes(fastify: FastifyInstance): Promise<void> {
  const serverAdapter = new FastifyAdapter();
  serverAdapter.setBasePath(BOARD_PREFIX);

  createBullBoard({
    queues: [new BullMQAdapter(getNotificationQueue())],
    serverAdapter,
  });

  // Guard: every request under /admin/queue requires ADMIN+ auth.
  fastify.addHook('onRequest', async (request, reply) => {
    if (!request.routeOptions?.url?.startsWith(BOARD_PREFIX)) return;
    await authMiddleware(request, reply);
    if (reply.sent) return;
    await requireRole('ADMIN')(request, reply);
  });

  await fastify.register(serverAdapter.registerPlugin(), { prefix: BOARD_PREFIX, logLevel: 'warn' });
}
