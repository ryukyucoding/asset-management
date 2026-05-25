import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { buildApiError, sendApiError } from '../error-response';

describe('error-response', () => {
  it('buildApiError returns nested error shape', () => {
    expect(buildApiError('NOT_FOUND', 404, 'Asset not found')).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Asset not found',
        statusCode: 404,
      },
    });
  });

  it('buildApiError includes optional details', () => {
    const details = { fieldErrors: { email: ['Invalid email'] } };
    expect(buildApiError('VALIDATION_ERROR', 400, 'Invalid request body', details)).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        statusCode: 400,
        details,
      },
    });
  });

  it('sendApiError sets HTTP status and body', async () => {
    const app = Fastify({ logger: false });
    app.get('/err', async (_request, reply) => {
      return sendApiError(reply, 'FORBIDDEN', 403, 'Insufficient permissions');
    });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/err' });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({
      error: {
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
        statusCode: 403,
      },
    });

    await app.close();
  });
});
