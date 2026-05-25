import type { FastifyInstance } from 'fastify';
import { AuthService } from '@services/auth/auth.service';
import { UserRepository } from '@infrastructure/repositories/user.repository';
import { LoginDTO, RegisterDTO } from '@dtos/auth.dto';
import { authMiddleware, requireRole } from '@middleware/auth.middleware';
import { verifyRefreshToken, signAccessToken } from '@services/auth/auth.service';
import { ERROR_CODES, HTTP_STATUS } from '@constants/error.constants';
import { sendApiError } from '@domain/errors/error-response';

const userRepo = new UserRepository();
const authService = new AuthService(userRepo);

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/auth/register', async (request, reply) => {
    const body = RegisterDTO.safeParse(request.body);
    if (!body.success) {
      return sendApiError(
        reply,
        ERROR_CODES.VALIDATION_ERROR,
        HTTP_STATUS.BAD_REQUEST,
        'Invalid request body',
        body.error.flatten(),
      );
    }

    try {
      const user = await authService.register(body.data);
      return reply.status(201).send({ user });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'Email already registered') {
        return sendApiError(reply, ERROR_CODES.CONFLICT, HTTP_STATUS.CONFLICT, err.message);
      }
      throw err;
    }
  });

  fastify.post('/auth/login', async (request, reply) => {
    const body = LoginDTO.safeParse(request.body);
    if (!body.success) {
      return sendApiError(
        reply,
        ERROR_CODES.VALIDATION_ERROR,
        HTTP_STATUS.BAD_REQUEST,
        'Invalid request body',
        body.error.flatten(),
      );
    }

    try {
      const result = await authService.login(body.data.email, body.data.password);
      return reply.send(result);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'Invalid credentials') {
        return sendApiError(
          reply,
          ERROR_CODES.UNAUTHORIZED,
          HTTP_STATUS.UNAUTHORIZED,
          'Invalid credentials',
        );
      }
      throw err;
    }
  });

  fastify.post('/auth/refresh', async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken?: string };
    if (!refreshToken) {
      return sendApiError(
        reply,
        ERROR_CODES.VALIDATION_ERROR,
        HTTP_STATUS.BAD_REQUEST,
        'refreshToken required',
      );
    }

    let payload: { userId: string };
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      return sendApiError(
        reply,
        ERROR_CODES.UNAUTHORIZED,
        HTTP_STATUS.UNAUTHORIZED,
        'Invalid refresh token',
      );
    }

    const user = await userRepo.findById(payload.userId);
    if (!user) {
      return sendApiError(reply, ERROR_CODES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');
    }

    const accessToken = signAccessToken({ userId: user.id, role: user.role });
    return reply.send({ accessToken });
  });

  fastify.post('/auth/logout', { preHandler: [authMiddleware] }, async (_request, reply) => {
    return reply.status(204).send();
  });

  fastify.get('/users', { preHandler: [authMiddleware, requireRole('ADMIN')] }, async (_request, reply) => {
    const users = await userRepo.findAll();
    return reply.send(users);
  });
}
