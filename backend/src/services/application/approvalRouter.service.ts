import type { ApplicationEntity } from '@domain/entities/application.entity';

export interface ApprovalStep {
  role: 'ADMIN';
  step: number;
}

/**
 * 解析維修申請的審批步驟。
 * 目前所有資產皆為 ADMIN 單步審批。
 */
export function resolveApprovalSteps(_application: ApplicationEntity): ApprovalStep[] {
  return [{ role: 'ADMIN', step: 1 }];
}
