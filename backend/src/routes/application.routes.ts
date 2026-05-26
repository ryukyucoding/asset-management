import type { FastifyInstance } from 'fastify';
import { ApplicationRepository } from '@infrastructure/repositories/application.repository';
import { AssetRepository } from '@infrastructure/repositories/asset.repository';
import { ApprovalRepository } from '@infrastructure/repositories/approval.repository';
import { NotificationRepository } from '@infrastructure/repositories/notification.repository';
import { UserRepository } from '@infrastructure/repositories/user.repository';
import { ApplicationService } from '@services/application/application.service';
import { NotificationService } from '@services/notification/notification.service';
import { CreateApplicationDTO, ReviewApplicationDTO, RepairDetailsDTO, ApplicationQueryDTO, UpdateApplicationDTO } from '@dtos/application.dto';
import { authMiddleware, requireRole } from '@middleware/auth.middleware';
import { handleAppError } from '@domain/errors/app.errors';
import { ERROR_CODES, HTTP_STATUS } from '@constants/error.constants';
import { sendApiError } from '@domain/errors/error-response';

const notificationService = new NotificationService(new NotificationRepository(), new UserRepository());
const applicationService = new ApplicationService(
  new ApplicationRepository(),
  new AssetRepository(),
  new ApprovalRepository(),
  notificationService,
);

export async function applicationRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/applications', { preHandler: [authMiddleware] }, async (request, reply) => {
    const query = ApplicationQueryDTO.safeParse(request.query);
    if (!query.success) {
      return sendApiError(
        reply,
        ERROR_CODES.VALIDATION_ERROR,
        HTTP_STATUS.BAD_REQUEST,
        'Invalid query parameters',
        query.error.flatten(),
      );
    }

    try {
      const result = await applicationService.list(query.data, request.user);
      return reply.send(result);
    } catch (err) {
      const handled = handleAppError(err, reply);
      if (handled) return handled;
      throw err;
    }
  });

  fastify.get('/applications/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const application = await applicationService.getById(id, request.user);
      return reply.send(application);
    } catch (err) {
      const handled = handleAppError(err, reply);
      if (handled) return handled;
      throw err;
    }
  });

  fastify.post('/applications', { preHandler: [authMiddleware] }, async (request, reply) => {
    const body = CreateApplicationDTO.safeParse(request.body);
    if (!body.success) {
      return sendApiError(
        reply,
        ERROR_CODES.VALIDATION_ERROR,
        HTTP_STATUS.BAD_REQUEST,
        'Invalid request body',
        body.error.flatten(),
      );
    }

    try {
      const application = await applicationService.submit(request.user.userId, body.data);
      return reply.status(201).send(application);
    } catch (err) {
      const handled = handleAppError(err, reply);
      if (handled) return handled;
      throw err;
    }
  });

  fastify.patch('/applications/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = UpdateApplicationDTO.safeParse(request.body);
    if (!body.success) {
      return sendApiError(
        reply,
        ERROR_CODES.VALIDATION_ERROR,
        HTTP_STATUS.BAD_REQUEST,
        'Invalid request body',
        body.error.flatten(),
      );
    }

    try {
      const updated = await applicationService.update(id, request.user.userId, body.data);
      return reply.send(updated);
    } catch (err) {
      const handled = handleAppError(err, reply);
      if (handled) return handled;
      throw err;
    }
  });

  // ─── 審核（目前統一為 ADMIN 單步審批）────────────────────────
  fastify.patch('/applications/:id/approve', { preHandler: [authMiddleware, requireRole('ADMIN', 'SENIOR_ADMIN')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = ReviewApplicationDTO.safeParse(request.body);
    if (!body.success) {
      return sendApiError(
        reply,
        ERROR_CODES.VALIDATION_ERROR,
        HTTP_STATUS.BAD_REQUEST,
        'Invalid request body',
        body.error.flatten(),
      );
    }

    try {
      const updated = await applicationService.approve(id, request.user, body.data);
      return reply.send(updated);
    } catch (err) {
      const handled = handleAppError(err, reply);
      if (handled) return handled;
      throw err;
    }
  });

  fastify.patch('/applications/:id/repair-details', { preHandler: [authMiddleware, requireRole('ADMIN')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = RepairDetailsDTO.safeParse(request.body);
    if (!body.success) {
      return sendApiError(
        reply,
        ERROR_CODES.VALIDATION_ERROR,
        HTTP_STATUS.BAD_REQUEST,
        'Invalid request body',
        body.error.flatten(),
      );
    }

    try {
      const updated = await applicationService.updateRepairDetails(id, body.data);
      return reply.send(updated);
    } catch (err) {
      const handled = handleAppError(err, reply);
      if (handled) return handled;
      throw err;
    }
  });

  fastify.patch('/applications/:id/complete', { preHandler: [authMiddleware, requireRole('ADMIN')] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const updated = await applicationService.complete(id);
      return reply.send(updated);
    } catch (err) {
      const handled = handleAppError(err, reply);
      if (handled) return handled;
      throw err;
    }
  });
}
