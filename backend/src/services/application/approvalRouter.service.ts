import type { ApplicationEntity } from '@domain/entities/application.entity';

export interface ApprovalStep {
  role: 'ADMIN' | 'SENIOR_ADMIN';
  step: number;
}

const HIGH_VALUE_CATEGORIES = ['HIGH_VALUE', 'SERVER', 'EQUIPMENT'];

/**
 * 解析維修申請的審批步驟。
 * 一般資產只需 ADMIN 一步；高價值資產需要 SENIOR_ADMIN 二步審批。
 */
export function resolveApprovalSteps(application: ApplicationEntity): ApprovalStep[] {
  const steps: ApprovalStep[] = [{ role: 'ADMIN', step: 1 }];

  if (application.asset && HIGH_VALUE_CATEGORIES.includes(application.asset.category)) {
    steps.push({ role: 'SENIOR_ADMIN', step: 2 });
  }

  return steps;
}
