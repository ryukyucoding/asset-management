-- Add PENDING_REPAIR value to AssetStatus enum
-- PostgreSQL requires the value to be committed before it can be used in the same transaction,
-- so this runs outside a transaction block.
ALTER TYPE "AssetStatus" ADD VALUE IF NOT EXISTS 'PENDING_REPAIR';
