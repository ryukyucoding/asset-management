import { z } from 'zod';

export const CreateApplicationDTO = z.object({
  assetId: z.string().cuid(),
  type: z.enum(['BORROW', 'CLAIM']),
  returnDate: z.string().datetime().optional(),
  reason: z.string().optional(),
}).refine(
  (data) => data.type !== 'BORROW' || data.returnDate !== undefined,
  { message: 'returnDate is required for BORROW applications', path: ['returnDate'] }
);

export const ReviewApplicationDTO = z.object({
  action: z.enum(['APPROVED', 'REJECTED']),
  comment: z.string().optional(),
});

export const ApplicationQueryDTO = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'RETURNED', 'CANCELLED']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateApplicationDTOType = z.infer<typeof CreateApplicationDTO>;
export type ReviewApplicationDTOType = z.infer<typeof ReviewApplicationDTO>;
export type ApplicationQueryDTOType = z.infer<typeof ApplicationQueryDTO>;
