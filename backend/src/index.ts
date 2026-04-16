import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import staticFiles from '@fastify/static';
import { authRoutes } from './routes/auth.routes';
import { assetRoutes } from './routes/asset.routes';
import { applicationRoutes } from './routes/application.routes';
import { notificationRoutes } from './routes/notification.routes';
import { uploadRoutes } from './routes/upload.routes';
import { prisma } from './infrastructure/database/prisma.client';

const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  },
});

async function bootstrap(): Promise<void> {
  await fastify.register(helmet, {
    // Allow images served from /uploads to load in the browser
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
  await fastify.register(cors, {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
  });
  await fastify.register(multipart);

  // Serve uploaded files from local disk only in local storage mode.
  // In GCS mode, files are served directly from GCS public URLs.
  if ((process.env.STORAGE_DRIVER ?? 'local') === 'local') {
    const { UPLOAD_DIR } = await import('./infrastructure/storage/local-storage.adapter');
    await fastify.register(staticFiles, {
      root: UPLOAD_DIR,
      prefix: '/uploads/',
    });
  }

  fastify.get('/health', async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', db: 'connected', timestamp: new Date().toISOString() };
    } catch {
      return { status: 'degraded', db: 'disconnected', timestamp: new Date().toISOString() };
    }
  });

  await fastify.register(authRoutes);
  await fastify.register(assetRoutes);
  await fastify.register(applicationRoutes);
  await fastify.register(notificationRoutes);
  await fastify.register(uploadRoutes);

  const port = Number(process.env.PORT ?? 3000);
  await fastify.listen({ port, host: '0.0.0.0' });
  fastify.log.info(`Server running on port ${port}`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
