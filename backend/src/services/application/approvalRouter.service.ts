import type { ApplicationEntity } from '@domain/entities/application.entity';

export interface ApprovalStep {
  role: 'ADMIN' | 'SENIOR_ADMIN' | 'DEPT_MANAGER';
  step: number;
}

const HIGH_VALUE_CATEGORIES = ['HIGH_VALUE', 'SERVER', 'EQUIPMENT'];
const BULK_THRESHOLD = 10;

export function resolveApprovalSteps(application: ApplicationEntity): ApprovalStep[] {
  const steps: ApprovalStep[] = [{ role: 'ADMIN', step: 1 }];

  if (application.asset && HIGH_VALUE_CATEGORIES.includes(application.asset.category)) {
    steps.push({ role: 'SENIOR_ADMIN', step: 2 });
  }

  if (application.user && application.asset && application.user.department !== application.asset.location) {
    steps.push({ role: 'DEPT_MANAGER', step: steps.length + 1 });
  }

  return steps;
}
