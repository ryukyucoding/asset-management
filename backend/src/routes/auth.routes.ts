import type { FastifyInstance } from 'fastify';
import { AuthService } from '@services/auth/auth.service';
import { UserRepository } from '@infrastructure/repositories/user.repository';
import { CachedUserRepository } from '@infrastructure/repositories/cached-user.repository';
import { RedisTokenStore } from '@infrastructure/cache/redis-token.store';
import { LoginDTO, RegisterDTO } from '@dtos/auth.dto';
import { authMiddleware, requireRole } from '@middleware/auth.middleware';
import { ERROR_CODES, HTTP_STATUS } from '@constants/error.constants';
import { sendApiError } from '@domain/errors/error-response';
import { incrementWithTtl } from '@infrastructure/cache/redis.client';
import { redisKeys } from '@infrastructure/cache/redis.keys';

const userRepo = new UserRepository();
const cachedUserRepo = new CachedUserRepository(userRepo);
const authService = new AuthService(cachedUserRepo, new RedisTokenStore());
const LOGIN_RATE_LIMIT_WINDOW_SECONDS = 60;
const LOGIN_RATE_LIMIT_MAX_REQUESTS = 10;

async function isLoginRateLimited(ip: string, fastify: FastifyInstance): Promise<boolean> {
  const key = redisKeys.rateLimitAuthLogin(ip);
  try {
    const attempts = await incrementWithTtl(key, LOGIN_RATE_LIMIT_WINDOW_SECONDS);
    return attempts > LOGIN_RATE_LIMIT_MAX_REQUESTS;
  } catch (error: unknown) {
    fastify.log.warn({ err: error }, 'Redis login rate limit unavailable; fallback to allow');
    return false;
  }
}

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

    if (await isLoginRateLimited(request.ip, fastify)) {
      return reply.status(429).send({
        error: 'TOO_MANY_REQUESTS',
        message: 'Too many login attempts. Please try again later.',
      });
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

    try {
      const result = await authService.refresh(refreshToken);
      return reply.send(result);
    } catch {
      return sendApiError(
        reply,
        ERROR_CODES.UNAUTHORIZED,
        HTTP_STATUS.UNAUTHORIZED,
        'Invalid refresh token',
      );
    }
  });

  fastify.post('/auth/logout', { preHandler: [authMiddleware] }, async (request, reply) => {
    await authService.logout(request.user.userId, request.user.jti);
    return reply.status(204).send();
  });

  fastify.get('/users', { preHandler: [authMiddleware, requireRole('ADMIN')] }, async (_request, reply) => {
    const users = await cachedUserRepo.findAll();
    return reply.send(users);
  });
}
