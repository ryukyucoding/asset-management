import type { FastifyInstance } from 'fastify';
import { ApplicationRepository } from '@infrastructure/repositories/application.repository';
import { AssetRepository } from '@infrastructure/repositories/asset.repository';
import { NotificationRepository } from '@infrastructure/repositories/notification.repository';
import { prisma } from '@infrastructure/database/prisma.client';
import { CreateApplicationDTO, ReviewApplicationDTO, RepairDetailsDTO, ApplicationQueryDTO, UpdateApplicationDTO } from '@dtos/application.dto';
import { authMiddleware, requireRole } from '@middleware/auth.middleware';
import { resolveApprovalSteps } from '@services/application/approvalRouter.service';

const applicationRepo  = new ApplicationRepository();
const assetRepo        = new AssetRepository();
const notificationRepo = new NotificationRepository();

export async function applicationRoutes(fastify: FastifyInstance): Promise<void> {
  // ─── 查詢申請列表 ─────────────────────────────────────────────
  fastify.get('/applications', { preHandler: [authMiddleware] }, async (request, reply) => {
    const query = ApplicationQueryDTO.safeParse(request.query);
    if (!query.success) return reply.status(400).send({ error: 'VALIDATION_ERROR', details: query.error.flatten() });

    // 一般使用者只能看自己的申請
    const userId = request.user.role === 'USER' ? request.user.userId : undefined;
    const result = await applicationRepo.findAll({ ...query.data, userId });
    return reply.send(result);
  });

  // ─── 取得單一申請 ─────────────────────────────────────────────
  fastify.get('/applications/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const application = await applicationRepo.findById(id);
    if (!application) return reply.status(404).send({ error: 'NOT_FOUND' });

    if (request.user.role === 'USER' && application.userId !== request.user.userId) {
      return reply.status(403).send({ error: 'FORBIDDEN' });
    }
    return reply.send(application);
  });

  // ─── 提交維修申請 ─────────────────────────────────────────────
  fastify.post('/applications', { preHandler: [authMiddleware] }, async (request, reply) => {
    const body = CreateApplicationDTO.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'VALIDATION_ERROR', details: body.error.flatten() });

    const asset = await assetRepo.findById(body.data.assetId);
    if (!asset) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Asset not found' });
    if (asset.status !== 'AVAILABLE') {
      return reply.status(409).send({ error: 'CONFLICT', message: 'Asset is not available for repair request' });
    }

    const application = await applicationRepo.create({
      userId:           request.user.userId,
      assetId:          body.data.assetId,
      status:           'PENDING',
      faultDescription: body.data.faultDescription,
      imageUrls:        body.data.imageUrls ?? [],
      repairDate:       null,
      repairContent:    null,
      repairSolution:   null,
      repairCost:       null,
      repairVendor:     null,
    });

    // 資產標記為「申請維修中」，讓使用者可見狀態變化
    await assetRepo.update(body.data.assetId, { status: 'PENDING_REPAIR' });

    // 通知所有管理員有新的維修申請
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
    await Promise.all(admins.map(admin =>
      notificationRepo.create({
        userId:  admin.id,
        type:    'APPLICATION_SUBMITTED',
        message: `「${asset.name}」有新的維修申請待審核`,
      })
    ));

    return reply.status(201).send(application);
  });

  // ─── 申請人修改申請內容（僅 PENDING 可編輯）──────────────────
  fastify.patch('/applications/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = UpdateApplicationDTO.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'VALIDATION_ERROR', details: body.error.flatten() });

    const application = await applicationRepo.findById(id);
    if (!application) return reply.status(404).send({ error: 'NOT_FOUND' });
    if (application.userId !== request.user.userId) {
      return reply.status(403).send({ error: 'FORBIDDEN' });
    }
    if (application.status !== 'PENDING') {
      return reply.status(409).send({ error: 'CONFLICT', message: 'Only PENDING applications can be edited' });
    }

    const updated = await applicationRepo.update(id, body.data);
    return reply.send(updated);
  });

  // ─── 審核（支援一般設備單步 / 高價值設備兩步審批）──────────
  fastify.patch('/applications/:id/approve', { preHandler: [authMiddleware, requireRole('ADMIN', 'SENIOR_ADMIN')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = ReviewApplicationDTO.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'VALIDATION_ERROR', details: body.error.flatten() });

    const application = await applicationRepo.findById(id);
    if (!application) return reply.status(404).send({ error: 'NOT_FOUND' });

    const pendingStatuses = ['PENDING', 'PENDING_SENIOR_APPROVAL'] as const;
    if (!pendingStatuses.includes(application.status as typeof pendingStatuses[number])) {
      return reply.status(409).send({ error: 'CONFLICT', message: 'Application is not pending review' });
    }

    // 根據設備類別決定所需審批步驟，再對應目前狀態決定當前步驟
    const steps = resolveApprovalSteps(application);
    const currentStepIndex = application.status === 'PENDING' ? 0 : 1;
    const currentStep = steps[currentStepIndex];

    if (!currentStep) {
      return reply.status(409).send({ error: 'CONFLICT', message: 'No approval step found for current status' });
    }

    // 確認操作者的角色符合當前步驟要求
    if (request.user.role !== currentStep.role) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: `Step ${currentStep.step} requires role ${currentStep.role}` });
    }

    await prisma.approval.create({
      data: {
        applicationId: id,
        approverId:    request.user.userId,
        step:          currentStep.step,
        action:        body.data.action,
        comment:       body.data.comment,
      },
    });

    const assetName = application.asset?.name ?? '資產';

    if (body.data.action === 'REJECTED') {
      await applicationRepo.update(id, { status: 'REJECTED' });
      await assetRepo.update(application.assetId, { status: 'AVAILABLE' });
      await notificationRepo.create({
        userId:  application.userId,
        type:    'APPLICATION_REJECTED',
        message: `你的「${assetName}」維修申請已被拒絕${body.data.comment ? `：${body.data.comment}` : ''}`,
      });
    } else if (currentStepIndex + 1 < steps.length) {
      // 尚有下一關：進入「待高階主管審核」
      await applicationRepo.update(id, { status: 'PENDING_SENIOR_APPROVAL' });
      const seniorAdmins = await prisma.user.findMany({ where: { role: 'SENIOR_ADMIN' }, select: { id: true } });
      await Promise.all(seniorAdmins.map(sa =>
        notificationRepo.create({
          userId:  sa.id,
          type:    'APPLICATION_PENDING_SENIOR_APPROVAL',
          message: `「${assetName}」維修申請需要您的最終審核`,
        })
      ));
    } else {
      // 全部審核通過 → 進入維修中
      await applicationRepo.update(id, { status: 'IN_REPAIR' });
      await assetRepo.update(application.assetId, { status: 'IN_REPAIR' });
      await notificationRepo.create({
        userId:  application.userId,
        type:    'APPLICATION_APPROVED',
        message: `你的「${assetName}」維修申請已通過審核，進入維修中`,
      });
    }

    const updated = await applicationRepo.findById(id);
    return reply.send(updated);
  });

  // ─── 填寫維修細節（維修中才可操作）───────────────────────────
  fastify.patch('/applications/:id/repair-details', { preHandler: [authMiddleware, requireRole('ADMIN')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = RepairDetailsDTO.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'VALIDATION_ERROR', details: body.error.flatten() });

    const application = await applicationRepo.findById(id);
    if (!application) return reply.status(404).send({ error: 'NOT_FOUND' });
    if (application.status !== 'IN_REPAIR') {
      return reply.status(409).send({ error: 'CONFLICT', message: 'Application is not in repair state' });
    }

    const { repairDate, ...rest } = body.data;
    const updated = await applicationRepo.update(id, {
      ...rest,
      ...(repairDate !== undefined && { repairDate: repairDate ? new Date(repairDate) : null }),
    });

    return reply.send(updated);
  });

  // ─── 維修完成 ─────────────────────────────────────────────────
  fastify.patch('/applications/:id/complete', { preHandler: [authMiddleware, requireRole('ADMIN')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const application = await applicationRepo.findById(id);
    if (!application) return reply.status(404).send({ error: 'NOT_FOUND' });
    if (application.status !== 'IN_REPAIR') {
      return reply.status(409).send({ error: 'CONFLICT', message: 'Application is not in repair state' });
    }

    const updated = await applicationRepo.update(id, { status: 'COMPLETED' });
    // 資產恢復正常使用
    const completedAsset = await assetRepo.findById(application.assetId);
    await assetRepo.update(application.assetId, { status: 'AVAILABLE' });

    // 通知申請人維修完成
    await notificationRepo.create({
      userId:  application.userId,
      type:    'REPAIR_COMPLETED',
      message: `你的「${completedAsset?.name ?? '資產'}」已維修完成，可正常使用`,
    });

    return reply.send(updated);
  });
}
