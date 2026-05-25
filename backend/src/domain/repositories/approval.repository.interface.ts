import type { ApprovalAction, ApprovalEntity } from '@domain/entities/approval.entity';

export interface CreateApprovalData {
  applicationId: string;
  approverId: string;
  step: number;
  action: ApprovalAction;
  comment?: string;
}

export interface IApprovalRepository {
  create(data: CreateApprovalData): Promise<ApprovalEntity>;
}
