import type { FastifyReply } from 'fastify';
import type { ERROR_CODES } from '@constants/error.constants';
import { sendApiError } from '@domain/errors/error-response';

type AppErrorCode = Extract<
  (typeof ERROR_CODES)[keyof typeof ERROR_CODES],
  'NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT'
>;

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: AppErrorCode,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function appErrorStatus(code: AppErrorCode): number {
  switch (code) {
    case 'NOT_FOUND': return 404;
    case 'FORBIDDEN': return 403;
    case 'CONFLICT': return 409;
  }
}

export function handleAppError(err: unknown, reply: FastifyReply): FastifyReply | void {
  if (err instanceof AppError) {
    const statusCode = appErrorStatus(err.code);
    return sendApiError(reply, err.code, statusCode, err.message);
  }
}
