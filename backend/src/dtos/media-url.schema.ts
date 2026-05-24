import { z } from 'zod';

/** Absolute URL or app-relative upload path (e.g. /uploads/uuid.jpg) */
export const mediaUrlSchema = z
  .string()
  .refine((val) => val.startsWith('/') || z.string().url().safeParse(val).success, {
    message: 'Must be a valid URL or path starting with /',
  });

export const mediaUrlArraySchema = z.array(mediaUrlSchema);
