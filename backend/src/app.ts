import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import staticFiles from '@fastify/static';
import { authRoutes } from './routes/auth.routes';
import { assetRoutes } from './routes/asset.routes';
import { applicationRoutes } from './routes/application.routes';
import { notificationRoutes } from './routes/notification.routes';
import { uploadRoutes } from './routes/upload.routes';
import { adminRoutes } from './routes/admin.routes';
import { ERROR_CODES, HTTP_STATUS } from './constants/error.constants';
import { sendApiError } from './domain/errors/error-response';
import { prisma } from './infrastructure/database/prisma.client';
import { pingRedis, closeRedisClient } from './infrastructure/cache/redis.client';
import { startNotificationWorker, closeNotificationQueue } from './infrastructure/queue/notification.queue';

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: process.env.NODE_ENV === 'test' ? false : {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  fastify.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    if (reply.sent) return;
    sendApiError(
      reply,
      ERROR_CODES.INTERNAL_ERROR,
      HTTP_STATUS.INTERNAL_ERROR,
      'Internal server error',
    );
  });

  await fastify.register(helmet, {
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
  await fastify.register(cors, {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
  });
  await fastify.register(multipart);

  if ((process.env.STORAGE_DRIVER ?? 'local') === 'local') {
    const { UPLOAD_DIR } = await import('./infrastructure/storage/local-storage.adapter');
    await fastify.register(staticFiles, {
      root: UPLOAD_DIR,
      prefix: '/uploads/',
    });
  }

  fastify.get('/health', async (_request, reply) => {
    const timestamp = new Date().toISOString();
    const redisConnected = await pingRedis();
    try {
      await prisma.$queryRaw`SELECT 1`;
      return reply.status(HTTP_STATUS.OK).send({
        status: redisConnected ? 'ok' : 'degraded',
        db: 'connected',
        redis: redisConnected ? 'connected' : 'disconnected',
        timestamp,
      });
    } catch {
      return reply.status(HTTP_STATUS.SERVICE_UNAVAILABLE).send({
        status: 'degraded',
        db: 'disconnected',
        redis: redisConnected ? 'connected' : 'disconnected',
        timestamp,
      });
    }
  });

  await fastify.register(authRoutes);
  await fastify.register(assetRoutes);
  await fastify.register(applicationRoutes);
  await fastify.register(notificationRoutes);
  await fastify.register(uploadRoutes);
  await fastify.register(adminRoutes);

  startNotificationWorker();

  fastify.addHook('onClose', async () => {
    await closeNotificationQueue();
    await closeRedisClient();
  });

  return fastify;
}
