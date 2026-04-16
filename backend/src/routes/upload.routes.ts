import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '@middleware/auth.middleware';
import { storageAdapter } from '@infrastructure/storage/storage.factory';

const MAX_FILES = 5;

export async function uploadRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /upload — upload up to 5 images, returns array of public URLs
  fastify.post('/upload', { preHandler: [authMiddleware] }, async (request, reply) => {
    const parts = request.files({ limits: { files: MAX_FILES } });
    const urls: string[] = [];

    for await (const part of parts) {
      try {
        const result = await storageAdapter.save(part);
        urls.push(result.url);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        return reply.status(400).send({ error: 'UPLOAD_ERROR', message });
      }
    }

    if (urls.length === 0) {
      return reply.status(400).send({ error: 'NO_FILES', message: 'No files were uploaded' });
    }

    return reply.status(201).send({ urls });
  });
}
