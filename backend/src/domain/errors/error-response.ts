import type { FastifyReply } from 'fastify';

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    statusCode: number;
    details?: unknown;
  };
}

export function buildApiError(
  code: string,
  statusCode: number,
  message: string,
  details?: unknown,
): ApiErrorBody {
  const body: ApiErrorBody = {
    error: { code, message, statusCode },
  };
  if (details !== undefined) {
    body.error.details = details;
  }
  return body;
}

export function sendApiError(
  reply: FastifyReply,
  code: string,
  statusCode: number,
  message: string,
  details?: unknown,
): FastifyReply {
  return reply.status(statusCode).send(buildApiError(code, statusCode, message, details));
}
