-- Add SENIOR_ADMIN value to Role enum
-- PostgreSQL requires the value to be committed before it can be used in the same transaction,
-- so this runs outside a transaction block.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SENIOR_ADMIN';

-- Add PENDING_SENIOR_APPROVAL value to ApplicationStatus enum
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'PENDING_SENIOR_APPROVAL';
