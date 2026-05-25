import type { FastifyInstance } from 'fastify';
import { AssetRepository } from '@infrastructure/repositories/asset.repository';
import { CreateAssetDTO, UpdateAssetDTO, AssetQueryDTO } from '@dtos/asset.dto';
import { authMiddleware, requireRole } from '@middleware/auth.middleware';
import { prisma } from '@infrastructure/database/prisma.client';
import { ERROR_CODES, HTTP_STATUS } from '@constants/error.constants';
import { sendApiError } from '@domain/errors/error-response';

const CATEGORY_PREFIX: Record<string, string> = {
  'IT設備':   'IT',
  '辦公設備': 'OFC',
  '實驗器材': 'LAB',
  '交通工具': 'VHC',
  'HIGH_VALUE': 'HV',
  '其他':     'GEN',
};

async function generateSerialNo(category: string): Promise<string> {
  const prefix = CATEGORY_PREFIX[category]
    ?? category.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, 'X');

  const existing = await prisma.asset.findMany({
    where:   { serialNo: { startsWith: `${prefix}-` } },
    select:  { serialNo: true },
  });

  let maxNum = 0;
  for (const a of existing) {
    const num = parseInt(a.serialNo.split('-')[1] ?? '0', 10);
    if (!isNaN(num) && num > maxNum) maxNum = num;
  }

  return `${prefix}-${String(maxNum + 1).padStart(8, '0')}`;
}

const assetRepo = new AssetRepository();

export async function assetRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/assets', { preHandler: [authMiddleware] }, async (request, reply) => {
    const query = AssetQueryDTO.safeParse(request.query);
    if (!query.success) {
      return sendApiError(
        reply,
        ERROR_CODES.VALIDATION_ERROR,
        HTTP_STATUS.BAD_REQUEST,
        'Invalid query parameters',
        query.error.flatten(),
      );
    }

    // 一般用戶只能看自己負責的資產
    const holderId = request.user.role === 'USER' ? request.user.userId : query.data.holderId;
    const result = await assetRepo.findAll({ ...query.data, holderId });
    return reply.send(result);
  });

  fastify.get('/assets/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const asset = await assetRepo.findById(id);
    if (!asset) {
      return sendApiError(reply, ERROR_CODES.NOT_FOUND, HTTP_STATUS.NOT_FOUND, 'Asset not found');
    }
    return reply.send(asset);
  });

  fastify.post('/assets', { preHandler: [authMiddleware, requireRole('ADMIN')] }, async (request, reply) => {
    const body = CreateAssetDTO.safeParse(request.body);
    if (!body.success) {
      return sendApiError(
        reply,
        ERROR_CODES.VALIDATION_ERROR,
        HTTP_STATUS.BAD_REQUEST,
        'Invalid request body',
        body.error.flatten(),
      );
    }

    const { purchaseDate, startDate, warrantyExpiry, ...rest } = body.data;

    const serialNo = await generateSerialNo(rest.category);

    const asset = await assetRepo.create({
      ...rest,
      serialNo,
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
    if (!body.success) {
      return sendApiError(
        reply,
        ERROR_CODES.VALIDATION_ERROR,
        HTTP_STATUS.BAD_REQUEST,
        'Invalid request body',
        body.error.flatten(),
      );
    }

    const existing = await assetRepo.findById(id);
    if (!existing) {
      return sendApiError(reply, ERROR_CODES.NOT_FOUND, HTTP_STATUS.NOT_FOUND, 'Asset not found');
    }

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
    if (!existing) {
      return sendApiError(reply, ERROR_CODES.NOT_FOUND, HTTP_STATUS.NOT_FOUND, 'Asset not found');
    }

    await assetRepo.delete(id);
    return reply.status(204).send();
  });
}
