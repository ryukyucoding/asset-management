import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken } from '@services/auth/auth.service';

export interface JwtPayload {
  userId: string;
  role: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: JwtPayload;
  }
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Missing or invalid token' });
    return;
  }

  try {
    const token = authHeader.slice(7);
    request.user = verifyAccessToken(token);
  } catch {
    reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!roles.includes(request.user?.role)) {
      reply.status(403).send({ error: 'FORBIDDEN', message: 'Insufficient permissions' });
    }
  };
}
