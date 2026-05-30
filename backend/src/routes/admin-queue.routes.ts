import type { FastifyInstance } from 'fastify';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import type { BaseAdapter } from '@bull-board/api/dist/src/queueAdapters/base';
import { FastifyAdapter } from '@bull-board/fastify';
import { getNotificationQueue } from '@infrastructure/queue/notification.queue';
import { authMiddleware, requireRole } from '@middleware/auth.middleware';

const BOARD_PREFIX = '/admin/queue';

export async function adminQueueRoutes(fastify: FastifyInstance): Promise<void> {
  const serverAdapter = new FastifyAdapter();
  serverAdapter.setBasePath(BOARD_PREFIX);

  createBullBoard({
    // BullMQ v5 JobProgress includes string; cast resolves the type mismatch.
    queues: [new BullMQAdapter(getNotificationQueue()) as unknown as BaseAdapter],
    serverAdapter,
  });

  // Guard: every request under /admin/queue requires ADMIN+ auth.
  fastify.addHook('onRequest', async (request, reply) => {
    if (!request.routeOptions?.url?.startsWith(BOARD_PREFIX)) return;
    await authMiddleware(request, reply);
    if (reply.sent) return;
    await requireRole('ADMIN')(request, reply);
  });

  // v5 adapter requires basePath to be passed explicitly in register options.
  await fastify.register(serverAdapter.registerPlugin(), {
    prefix: BOARD_PREFIX,
    basePath: BOARD_PREFIX,
    logLevel: 'warn',
  });
}
