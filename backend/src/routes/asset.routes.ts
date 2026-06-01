import type { FastifyInstance } from 'fastify';
import { AssetRepository } from '@infrastructure/repositories/asset.repository';
import { CachedAssetRepository } from '@infrastructure/repositories/cached-asset.repository';
import { CreateAssetDTO, UpdateAssetDTO, AssetQueryDTO } from '@dtos/asset.dto';
import { authMiddleware, requireRole } from '@middleware/auth.middleware';
import { idempotencyMiddleware } from '@middleware/idempotency.middleware';
import { prisma } from '@infrastructure/database/prisma.client';
import { ERROR_CODES, HTTP_STATUS } from '@constants/error.constants';
import { sendApiError } from '@domain/errors/error-response';
import { nextSerialNumber, formatSerialNo, reseedSerialCounter } from '@infrastructure/cache/serial-counter';
import { getAssetStats } from '@infrastructure/cache/asset-stats.cache';

const CATEGORY_PREFIX: Record<string, string> = {
  'IT設備':   'IT',
  '辦公設備': 'OFC',
  '實驗器材': 'LAB',
  '交通工具': 'VHC',
  'HIGH_VALUE': 'HV',
  '其他':     'GEN',
};

function resolvePrefix(category: string): string {
  return CATEGORY_PREFIX[category]
    ?? category.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, 'X');
}

async function generateSerialNoFromDb(prefix: string): Promise<string> {
  const existing = await prisma.asset.findMany({
    where:   { serialNo: { startsWith: `${prefix}-` } },
    select:  { serialNo: true },
  });

  let maxNum = 0;
  for (const a of existing) {
    const num = Number.parseInt(a.serialNo.split('-')[1] ?? '0', 10);
    if (!Number.isNaN(num) && num > maxNum) maxNum = num;
  }

  return formatSerialNo(prefix, maxNum + 1);
}

async function generateSerialNo(category: string): Promise<string> {
  const prefix = resolvePrefix(category);
  const next = await nextSerialNumber(prefix);
  if (next !== null) {
    return formatSerialNo(prefix, next);
  }
  return generateSerialNoFromDb(prefix);
}

const assetRepo = new CachedAssetRepository(new AssetRepository());

function isUniqueSerialConstraintError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { code?: string; meta?: { target?: unknown } };
  if (e.code !== 'P2002') return false;
  const target = e.meta?.target;
  if (typeof target === 'string') return target.includes('serialNo');
  if (Array.isArray(target)) return target.some((t) => String(t).includes('serialNo'));
  return true;
}

type AssetCreatePayload = Parameters<typeof assetRepo.create>[0];

async function createWithSerialRetry(
  category: string,
  buildPayload: (serialNo: string) => AssetCreatePayload,
) {
  const prefix = resolvePrefix(category);
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const serialNo = await generateSerialNo(category);
    try {
      return await assetRepo.create(buildPayload(serialNo));
    } catch (err) {
      lastErr = err;
      if (!isUniqueSerialConstraintError(err)) throw err;
      // Cache drifted behind DB — reseed from MAX(serialNo) and retry.
      await reseedSerialCounter(prefix);
    }
  }
  throw lastErr ?? new Error('Failed to allocate serial number');
}

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

  fastify.get('/assets/stats', { preHandler: [authMiddleware] }, async (request, reply) => {
    const holderId = request.user.role === 'USER' ? request.user.userId : undefined;
    const stats = await getAssetStats({ holderId });
    return reply.send(stats);
  });

  fastify.get('/assets/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const asset = await assetRepo.findById(id);
    if (!asset) {
      return sendApiError(reply, ERROR_CODES.NOT_FOUND, HTTP_STATUS.NOT_FOUND, 'Asset not found');
    }
    return reply.send(asset);
  });

  fastify.post('/assets', { preHandler: [authMiddleware, requireRole('ADMIN'), idempotencyMiddleware] }, async (request, reply) => {
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

    const buildPayload = (serialNo: string) => ({
      ...rest,
      serialNo,
      purchaseDate:   purchaseDate   ? new Date(purchaseDate)   : null,
      startDate:      startDate      ? new Date(startDate)      : null,
      warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : null,
      status: 'AVAILABLE' as const,
      model:         rest.model         ?? null,
      spec:          rest.spec          ?? null,
      supplier:      rest.supplier      ?? null,
      purchaseCost:  rest.purchaseCost  ?? null,
      assignedDept:  rest.assignedDept  ?? null,
      holderId:      rest.holderId      ?? null,
      description:   rest.description   ?? null,
      imageUrls:     rest.imageUrls     ?? [],
    });

    const asset = await createWithSerialRetry(rest.category, buildPayload);
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
