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

export interface ApplicationActor {
  userId: string;
  role: UserRole;
}

const PENDING_REVIEW_STATUSES = ['PENDING', 'PENDING_SENIOR_APPROVAL'] as const;

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
    const asset = await this.assetRepo.findById(data.assetId);
    if (!asset) throw new AppError('Asset not found', 'NOT_FOUND');
    if (asset.status !== 'AVAILABLE') {
      throw new AppError('Asset is not available for repair request', 'CONFLICT');
    }

    const application = await this.applicationRepo.create({
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
    });

    await this.assetRepo.update(data.assetId, { status: 'PENDING_REPAIR' });
    await this.notificationService.notifyApplicationSubmitted(asset.name);

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

    const steps = resolveApprovalSteps(application);
    const currentStepIndex = application.status === 'PENDING' ? 0 : 1;
    const currentStep = steps[currentStepIndex];

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
    } else if (currentStepIndex + 1 < steps.length) {
      updated = await this.applicationRepo.update(id, { status: 'PENDING_SENIOR_APPROVAL' });
      await this.notificationService.notifyPendingSeniorApproval(assetName);
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
