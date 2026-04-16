import { z } from 'zod';

export const LoginDTO = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const RegisterDTO = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  department: z.string().optional(),
});

export type LoginDTOType = z.infer<typeof LoginDTO>;
export type RegisterDTOType = z.infer<typeof RegisterDTO>;
