import type { FastifyInstance } from 'fastify';
import { AuthService } from '@services/auth/auth.service';
import { UserRepository } from '@infrastructure/repositories/user.repository';
import { LoginDTO, RegisterDTO } from '@dtos/auth.dto';
import { authMiddleware } from '@middleware/auth.middleware';
import { verifyRefreshToken, signAccessToken } from '@services/auth/auth.service';

const userRepo = new UserRepository();
const authService = new AuthService(userRepo);

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/auth/register', async (request, reply) => {
    const body = RegisterDTO.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'VALIDATION_ERROR', details: body.error.flatten() });

    try {
      const user = await authService.register(body.data);
      return reply.status(201).send({ user });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'Email already registered') {
        return reply.status(409).send({ error: 'CONFLICT', message: err.message });
      }
      throw err;
    }
  });

  fastify.post('/auth/login', async (request, reply) => {
    const body = LoginDTO.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'VALIDATION_ERROR', details: body.error.flatten() });

    try {
      const result = await authService.login(body.data.email, body.data.password);
      return reply.send(result);
    } catch {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Invalid credentials' });
    }
  });

  fastify.post('/auth/refresh', async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken?: string };
    if (!refreshToken) return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'refreshToken required' });

    try {
      const payload = verifyRefreshToken(refreshToken);
      const user = await userRepo.findById(payload.userId);
      if (!user) return reply.status(401).send({ error: 'UNAUTHORIZED' });

      const accessToken = signAccessToken({ userId: user.id, role: user.role });
      return reply.send({ accessToken });
    } catch {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Invalid refresh token' });
    }
  });

  fastify.post('/auth/logout', { preHandler: [authMiddleware] }, async (_request, reply) => {
    return reply.status(204).send();
  });
}
