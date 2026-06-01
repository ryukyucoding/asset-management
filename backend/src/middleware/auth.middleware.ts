import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken, isAccessTokenDenied } from '@services/auth/auth.service';
import type { UserRole } from '@domain/entities/user.entity';
import { ERROR_CODES, HTTP_STATUS } from '@constants/error.constants';
import { sendApiError } from '@domain/errors/error-response';

export interface JwtPayload {
  userId: string;
  role: UserRole;
  jti: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: JwtPayload;
  }
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    sendApiError(reply, ERROR_CODES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED, 'Missing or invalid token');
    return;
  }

  try {
    const token = authHeader.slice(7);
    const payload = verifyAccessToken(token);

    if (payload.jti && (await isAccessTokenDenied(payload.jti))) {
      sendApiError(reply, ERROR_CODES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED, 'Token has been revoked');
      return;
    }

    request.user = {
      userId: payload.userId,
      role: payload.role,
      jti: payload.jti,
    };
  } catch {
    sendApiError(reply, ERROR_CODES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED, 'Invalid or expired token');
    return;
  }
}

export function requireRole(...roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!roles.includes(request.user?.role)) {
      return sendApiError(reply, ERROR_CODES.FORBIDDEN, HTTP_STATUS.FORBIDDEN, 'Insufficient permissions');
    }
  };
}
