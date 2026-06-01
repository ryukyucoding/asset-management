import type { IApplicationRepository } from '@domain/repositories/application.repository.interface';
import type { IAssetRepository } from '@domain/repositories/asset.repository.interface';
import type { IApprovalRepository } from '@domain/repositories/approval.repository.interface';
import type { ApplicationEntity } from '@domain/entities/application.entity';
import type { UserRole } from '@domain/entities/user.entity';
import type {
  ApplicationQueryDTOType,
  CreateApplicationDTOType,
  RepairDetailsDTOType,
  ReviewApplicationDTOType,
  UpdateApplicationDTOType,
} from '@dtos/application.dto';
import { AppError } from '@domain/errors/app.errors';
import { resolveApprovalSteps } from './approvalRouter.service';
import type { NotificationService } from '@services/notification/notification.service';
import { prisma } from '@infrastructure/database/prisma.client';
import { Prisma } from '@prisma/client';

export interface ApplicationActor {
  userId: string;
  role: UserRole;
}

const PENDING_REVIEW_STATUSES = ['PENDING'] as const;

export class ApplicationService {
  constructor(
    private readonly applicationRepo: IApplicationRepository,
    private readonly assetRepo: IAssetRepository,
    private readonly approvalRepo: IApprovalRepository,
    private readonly notificationService: NotificationService,
  ) {}

  async list(query: ApplicationQueryDTOType, actor: ApplicationActor) {
    const userId = actor.role === 'USER' ? actor.userId : query.userId;
    return this.applicationRepo.findAll({ ...query, userId });
  }

  async getById(id: string, actor: ApplicationActor): Promise<ApplicationEntity> {
    const application = await this.applicationRepo.findById(id);
    if (!application) throw new AppError('Application not found', 'NOT_FOUND');

    if (actor.role === 'USER' && application.userId !== actor.userId) {
      throw new AppError('Forbidden', 'FORBIDDEN');
    }

    return application;
  }

  async submit(userId: string, data: CreateApplicationDTOType): Promise<ApplicationEntity> {
    const includeRelations = {
      user: { select: { id: true, name: true, email: true, department: true, role: true, createdAt: true, updatedAt: true } },
      asset: true,
    } as const;

    // SELECT FOR UPDATE locks the asset row; concurrent requests block here until the transaction commits.
    // Serializable isolation prevents phantom reads if two transactions race on the same asset.
    const [application, assetName] = await prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<Array<{ id: string; status: string; name: string }>>`
        SELECT id, status, name FROM "Asset" WHERE id = ${data.assetId} FOR UPDATE
      `;

      if (!locked) throw new AppError('Asset not found', 'NOT_FOUND');
      if (locked.status !== 'AVAILABLE') {
        throw new AppError('Asset is not available for repair request', 'CONFLICT');
      }

      const created = await tx.application.create({
        data: {
          userId,
          assetId: data.assetId,
          status: 'PENDING',
          faultDescription: data.faultDescription,
          imageUrls: data.imageUrls ?? [],
          repairDate: null,
          repairContent: null,
          repairSolution: null,
          repairCost: null,
          repairVendor: null,
        },
        include: includeRelations,
      });

      await tx.asset.update({ where: { id: data.assetId }, data: { status: 'PENDING_REPAIR' } });

      return [created as ApplicationEntity, locked.name] as const;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    await this.notificationService.notifyApplicationSubmitted(assetName);

    return application;
  }

  async update(id: string, userId: string, data: UpdateApplicationDTOType): Promise<ApplicationEntity> {
    const application = await this.applicationRepo.findById(id);
    if (!application) throw new AppError('Application not found', 'NOT_FOUND');
    if (application.userId !== userId) throw new AppError('Forbidden', 'FORBIDDEN');
    if (application.status !== 'PENDING') {
      throw new AppError('Only PENDING applications can be edited', 'CONFLICT');
    }

    return this.applicationRepo.update(id, data);
  }

  async approve(
    id: string,
    approver: ApplicationActor,
    data: ReviewApplicationDTOType,
  ): Promise<ApplicationEntity> {
    const application = await this.applicationRepo.findById(id);
    if (!application) throw new AppError('Application not found', 'NOT_FOUND');

    if (!PENDING_REVIEW_STATUSES.includes(application.status as typeof PENDING_REVIEW_STATUSES[number])) {
      throw new AppError('Application is not pending review', 'CONFLICT');
    }

    // 統一為單步審批。
    const steps = resolveApprovalSteps(application);
    const currentStep = steps[0];

    if (!currentStep) {
      throw new AppError('No approval step found for current status', 'CONFLICT');
    }

    if (approver.role !== currentStep.role) {
      throw new AppError(`Step ${currentStep.step} requires role ${currentStep.role}`, 'FORBIDDEN');
    }

    await this.approvalRepo.create({
      applicationId: id,
      approverId: approver.userId,
      step: currentStep.step,
      action: data.action,
      comment: data.comment,
    });

    const assetName = application.asset?.name ?? '資產';

    let updated: ApplicationEntity;
    if (data.action === 'REJECTED') {
      updated = await this.applicationRepo.update(id, { status: 'REJECTED' });
      await this.assetRepo.update(application.assetId, { status: 'AVAILABLE' });
      await this.notificationService.notifyApplicationRejected(application.userId, assetName, data.comment);
    } else {
      updated = await this.applicationRepo.update(id, { status: 'IN_REPAIR' });
      await this.assetRepo.update(application.assetId, { status: 'IN_REPAIR' });
      await this.notificationService.notifyApplicationApproved(application.userId, assetName);
    }

    return updated;
  }

  async updateRepairDetails(id: string, data: RepairDetailsDTOType): Promise<ApplicationEntity> {
    const application = await this.applicationRepo.findById(id);
    if (!application) throw new AppError('Application not found', 'NOT_FOUND');
    if (application.status !== 'IN_REPAIR') {
      throw new AppError('Application is not in repair state', 'CONFLICT');
    }

    const { repairDate, ...rest } = data;
    return this.applicationRepo.update(id, {
      ...rest,
      ...(repairDate !== undefined && { repairDate: repairDate ? new Date(repairDate) : null }),
    });
  }

  async complete(id: string): Promise<ApplicationEntity> {
    const application = await this.applicationRepo.findById(id);
    if (!application) throw new AppError('Application not found', 'NOT_FOUND');
    if (application.status !== 'IN_REPAIR') {
      throw new AppError('Application is not in repair state', 'CONFLICT');
    }

    const assetName = application.asset?.name ?? '資產';
    const updated = await this.applicationRepo.update(id, { status: 'COMPLETED' });
    await this.assetRepo.update(application.assetId, { status: 'AVAILABLE' });
    await this.notificationService.notifyRepairCompleted(application.userId, assetName);

    return updated;
  }
}
