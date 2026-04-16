export type ApprovalAction = 'APPROVED' | 'REJECTED';

export interface ApprovalEntity {
  id: string;
  applicationId: string;
  approverId: string;
  step: number;
  action: ApprovalAction;
  comment: string | null;
  createdAt: Date;
}
