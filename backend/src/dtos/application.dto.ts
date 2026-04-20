import { z } from 'zod';

export const CreateApplicationDTO = z.object({
  assetId:          z.string().cuid(),
  faultDescription: z.string().min(5, 'faultDescription is required and must be at least 5 characters'),
  imageUrls:        z.array(z.string().url()).optional().default([]),
});

export const ReviewApplicationDTO = z.object({
  action:  z.enum(['APPROVED', 'REJECTED']),
  comment: z.string().optional(),
});

export const RepairDetailsDTO = z.object({
  repairDate:     z.string().datetime({ offset: true }).optional(),
  repairContent:  z.string().optional(),
  repairSolution: z.string().optional(),
  repairCost:     z.number().nonnegative().optional(),
  repairVendor:   z.string().optional(),
});

export const UpdateApplicationDTO = z.object({
  faultDescription: z.string().min(5).optional(),
  imageUrls:        z.array(z.string()).optional(),
});

export const ApplicationQueryDTO = z.object({
  status:  z.enum(['PENDING', 'IN_REPAIR', 'COMPLETED', 'REJECTED']).optional(),
  assetId: z.string().optional(),
  userId:  z.string().optional(),
  page:    z.coerce.number().int().positive().default(1),
  limit:   z.coerce.number().int().positive().max(100).default(20),
});

export type CreateApplicationDTOType = z.infer<typeof CreateApplicationDTO>;
export type ReviewApplicationDTOType = z.infer<typeof ReviewApplicationDTO>;
export type RepairDetailsDTOType     = z.infer<typeof RepairDetailsDTO>;
export type UpdateApplicationDTOType = z.infer<typeof UpdateApplicationDTO>;
export type ApplicationQueryDTOType  = z.infer<typeof ApplicationQueryDTO>;
