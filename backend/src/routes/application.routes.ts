import type { FastifyInstance } from 'fastify';
import { ApplicationRepository } from '@infrastructure/repositories/application.repository';
import { AssetRepository } from '@infrastructure/repositories/asset.repository';
import { prisma } from '@infrastructure/database/prisma.client';
import { CreateApplicationDTO, ReviewApplicationDTO, ApplicationQueryDTO } from '@dtos/application.dto';
import { authMiddleware, requireRole } from '@middleware/auth.middleware';
import { resolveApprovalSteps } from '@services/application/approvalRouter.service';

const applicationRepo = new ApplicationRepository();
const assetRepo = new AssetRepository();

export async function applicationRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/applications', { preHandler: [authMiddleware] }, async (request, reply) => {
    const query = ApplicationQueryDTO.safeParse(request.query);
    if (!query.success) return reply.status(400).send({ error: 'VALIDATION_ERROR', details: query.error.flatten() });

    const userId = request.user.role === 'USER' ? request.user.userId : undefined;
    const result = await applicationRepo.findAll({ ...query.data, userId });
    return reply.send(result);
  });

  fastify.get('/applications/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const application = await applicationRepo.findById(id);
    if (!application) return reply.status(404).send({ error: 'NOT_FOUND' });

    if (request.user.role === 'USER' && application.userId !== request.user.userId) {
      return reply.status(403).send({ error: 'FORBIDDEN' });
    }
    return reply.send(application);
  });

  fastify.post('/applications', { preHandler: [authMiddleware] }, async (request, reply) => {
    const body = CreateApplicationDTO.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'VALIDATION_ERROR', details: body.error.flatten() });

    const asset = await assetRepo.findById(body.data.assetId);
    if (!asset) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Asset not found' });
    if (asset.status !== 'AVAILABLE') return reply.status(409).send({ error: 'CONFLICT', message: 'Asset is not available' });

    const application = await applicationRepo.create({
      userId: request.user.userId,
      assetId: body.data.assetId,
      type: body.data.type,
      status: 'PENDING',
      returnDate: body.data.returnDate ? new Date(body.data.returnDate) : null,
      reason: body.data.reason ?? null,
    });

    return reply.status(201).send(application);
  });

  fastify.patch('/applications/:id/approve', { preHandler: [authMiddleware, requireRole('ADMIN')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = ReviewApplicationDTO.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'VALIDATION_ERROR', details: body.error.flatten() });

    const application = await applicationRepo.findById(id);
    if (!application) return reply.status(404).send({ error: 'NOT_FOUND' });
    if (application.status !== 'PENDING') return reply.status(409).send({ error: 'CONFLICT', message: 'Application is not pending' });

    await prisma.approval.create({
      data: {
        applicationId: id,
        approverId: request.user.userId,
        step: 1,
        action: body.data.action,
        comment: body.data.comment,
      },
    });

    const newStatus = body.data.action === 'APPROVED' ? 'APPROVED' : 'REJECTED';
    const updated = await applicationRepo.update(id, { status: newStatus });

    if (newStatus === 'APPROVED') {
      const assetStatus = application.type === 'BORROW' ? 'BORROWED' : 'CLAIMED';
      await assetRepo.update(application.assetId, { status: assetStatus, holderId: application.userId });
    }

    return reply.send(updated);
  });

  fastify.patch('/applications/:id/return', { preHandler: [authMiddleware, requireRole('ADMIN')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const application = await applicationRepo.findById(id);
    if (!application) return reply.status(404).send({ error: 'NOT_FOUND' });
    if (application.status !== 'APPROVED' || application.type !== 'BORROW') {
      return reply.status(409).send({ error: 'CONFLICT', message: 'Invalid state for return' });
    }

    const updated = await applicationRepo.update(id, { status: 'RETURNED' });
    await assetRepo.update(application.assetId, { status: 'AVAILABLE', holderId: null });
    return reply.send(updated);
  });
}
