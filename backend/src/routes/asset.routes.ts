import type { FastifyInstance } from 'fastify';
import { AssetRepository } from '@infrastructure/repositories/asset.repository';
import { CreateAssetDTO, UpdateAssetDTO, AssetQueryDTO } from '@dtos/asset.dto';
import { authMiddleware, requireRole } from '@middleware/auth.middleware';

const assetRepo = new AssetRepository();

export async function assetRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/assets', { preHandler: [authMiddleware] }, async (request, reply) => {
    const query = AssetQueryDTO.safeParse(request.query);
    if (!query.success) return reply.status(400).send({ error: 'VALIDATION_ERROR', details: query.error.flatten() });

    // 一般用戶只能看自己負責的資產
    const holderId = request.user.role === 'USER' ? request.user.userId : query.data.holderId;
    const result = await assetRepo.findAll({ ...query.data, holderId });
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

    const { purchaseDate, startDate, warrantyExpiry, ...rest } = body.data;
    const asset = await assetRepo.create({
      ...rest,
      purchaseDate:   purchaseDate   ? new Date(purchaseDate)   : null,
      startDate:      startDate      ? new Date(startDate)      : null,
      warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : null,
      status: 'AVAILABLE',
      model:         rest.model         ?? null,
      spec:          rest.spec          ?? null,
      supplier:      rest.supplier      ?? null,
      purchaseCost:  rest.purchaseCost  ?? null,
      assignedDept:  rest.assignedDept  ?? null,
      holderId:      rest.holderId      ?? null,
      description:   rest.description   ?? null,
      imageUrls:     rest.imageUrls     ?? [],
    });
    return reply.status(201).send(asset);
  });

  fastify.patch('/assets/:id', { preHandler: [authMiddleware, requireRole('ADMIN')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = UpdateAssetDTO.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'VALIDATION_ERROR', details: body.error.flatten() });

    const existing = await assetRepo.findById(id);
    if (!existing) return reply.status(404).send({ error: 'NOT_FOUND' });

    const { purchaseDate, startDate, warrantyExpiry, ...rest } = body.data;
    const updated = await assetRepo.update(id, {
      ...rest,
      ...(purchaseDate   !== undefined && { purchaseDate:   purchaseDate   ? new Date(purchaseDate)   : null }),
      ...(startDate      !== undefined && { startDate:      startDate      ? new Date(startDate)      : null }),
      ...(warrantyExpiry !== undefined && { warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : null }),
    });
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
