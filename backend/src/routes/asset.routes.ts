import type { FastifyInstance } from 'fastify';
import { AssetRepository } from '@infrastructure/repositories/asset.repository';
import { CreateAssetDTO, UpdateAssetDTO, AssetQueryDTO } from '@dtos/asset.dto';
import { authMiddleware, requireRole } from '@middleware/auth.middleware';

const assetRepo = new AssetRepository();

export async function assetRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/assets', { preHandler: [authMiddleware] }, async (request, reply) => {
    const query = AssetQueryDTO.safeParse(request.query);
    if (!query.success) return reply.status(400).send({ error: 'VALIDATION_ERROR', details: query.error.flatten() });

    const result = await assetRepo.findAll(query.data);
    return reply.send(result);
  });

  fastify.get('/assets/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const asset = await assetRepo.findById(id);
    if (!asset) return reply.status(404).send({ error: 'NOT_FOUND' });
    return reply.send(asset);
  });

  fastify.post('/assets', { preHandler: [authMiddleware, requireRole('ADMIN')] }, async (request, reply) => {
    const body = CreateAssetDTO.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'VALIDATION_ERROR', details: body.error.flatten() });

    const asset = await assetRepo.create({ ...body.data, status: 'AVAILABLE', holderId: null, description: body.data.description ?? null });
    return reply.status(201).send(asset);
  });

  fastify.patch('/assets/:id', { preHandler: [authMiddleware, requireRole('ADMIN')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = UpdateAssetDTO.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'VALIDATION_ERROR', details: body.error.flatten() });

    const existing = await assetRepo.findById(id);
    if (!existing) return reply.status(404).send({ error: 'NOT_FOUND' });

    const updated = await assetRepo.update(id, body.data);
    return reply.send(updated);
  });

  fastify.delete('/assets/:id', { preHandler: [authMiddleware, requireRole('ADMIN')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await assetRepo.findById(id);
    if (!existing) return reply.status(404).send({ error: 'NOT_FOUND' });

    await assetRepo.delete(id);
    return reply.status(204).send();
  });
}
