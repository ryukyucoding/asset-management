import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { signAccessToken } from '@services/auth/auth.service';

// ─── Hoist mock for storage adapter ────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  save:    vi.fn(),
  filesFn: vi.fn(),   // controls what request.files() yields
}));

vi.mock('@infrastructure/storage/storage.factory', () => ({
  storageAdapter: { save: mocks.save },
}));

// ─── Mock user repo so authMiddleware can resolve the token ────────────────
const userMocks = vi.hoisted(() => ({
  findById: vi.fn(),
}));

vi.mock('@infrastructure/repositories/user.repository', () => ({
  UserRepository: vi.fn().mockImplementation(() => ({
    findById: userMocks.findById,
  })),
}));

import { uploadRoutes } from '../upload.routes';

// ─── Helpers ──────────────────────────────────────────────────────────────
const userToken = signAccessToken({ userId: 'user-1', role: 'USER' });

const fakeUser = {
  id: 'user-1', name: 'Alice', email: 'alice@example.com',
  role: 'USER' as const, department: 'IT',
  passwordHash: 'x', createdAt: new Date(), updatedAt: new Date(),
};

/** Fake multipart "part" objects */
function makePart(filename = 'photo.jpg', mimetype = 'image/jpeg') {
  return { filename, mimetype, file: { pipe: vi.fn() } };
}

/** Build a Fastify app with a mocked request.files() decorator */
async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  // Inject mock multipart support without registering the real plugin
  // (real @fastify/multipart v10 requires Fastify 5.x; project uses 4.x)
  app.decorateRequest('files', function (this: FastifyRequest) {
    return mocks.filesFn();
  });

  await app.register(uploadRoutes);
  await app.ready();
  return app;
}

/** Make an async generator that yields the given parts */
async function* makePartsIterable(parts: ReturnType<typeof makePart>[]) {
  yield* parts;
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('POST /upload', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    userMocks.findById.mockResolvedValue(fakeUser);
    app = await buildApp();
  });

  afterEach(() => app.close());

  // ── auth guard ───────────────────────────────────────────────────────────

  it('401 — rejects unauthenticated requests', async () => {
    const res = await app.inject({ method: 'POST', url: '/upload' });
    expect(res.statusCode).toBe(401);
  });

  // ── no files ─────────────────────────────────────────────────────────────

  it('400 NO_FILES — rejects when no parts are yielded', async () => {
    mocks.filesFn.mockReturnValue(makePartsIterable([]));

    const res = await app.inject({
      method: 'POST',
      url: '/upload',
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('NO_FILES');
  });

  // ── successful upload ─────────────────────────────────────────────────────

  it('201 — returns urls array for a single uploaded file', async () => {
    mocks.filesFn.mockReturnValue(makePartsIterable([makePart('photo.jpg')]));
    mocks.save.mockResolvedValue({ url: 'http://localhost:3000/uploads/abc.jpg' });

    const res = await app.inject({
      method: 'POST',
      url: '/upload',
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().urls).toEqual(['http://localhost:3000/uploads/abc.jpg']);
    expect(mocks.save).toHaveBeenCalledOnce();
  });

  it('201 — returns multiple urls when multiple files are uploaded', async () => {
    mocks.filesFn.mockReturnValue(
      makePartsIterable([makePart('a.jpg'), makePart('b.jpg')])
    );
    mocks.save
      .mockResolvedValueOnce({ url: 'http://localhost:3000/uploads/a.jpg' })
      .mockResolvedValueOnce({ url: 'http://localhost:3000/uploads/b.jpg' });

    const res = await app.inject({
      method: 'POST',
      url: '/upload',
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().urls).toHaveLength(2);
    expect(mocks.save).toHaveBeenCalledTimes(2);
  });

  it('passes the part object directly to storageAdapter.save', async () => {
    const part = makePart('asset.png', 'image/png');
    mocks.filesFn.mockReturnValue(makePartsIterable([part]));
    mocks.save.mockResolvedValue({ url: 'http://localhost:3000/uploads/asset.png' });

    await app.inject({
      method: 'POST',
      url: '/upload',
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(mocks.save).toHaveBeenCalledWith(part);
  });

  // ── storage error ─────────────────────────────────────────────────────────

  it('400 UPLOAD_ERROR — returns error when storage adapter throws an Error', async () => {
    mocks.filesFn.mockReturnValue(makePartsIterable([makePart()]));
    mocks.save.mockRejectedValue(new Error('GCS write failed'));

    const res = await app.inject({
      method: 'POST',
      url: '/upload',
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('UPLOAD_ERROR');
    expect(res.json().message).toBe('GCS write failed');
  });

  it('400 UPLOAD_ERROR — includes generic message for non-Error throws', async () => {
    mocks.filesFn.mockReturnValue(makePartsIterable([makePart()]));
    mocks.save.mockRejectedValue('unexpected string error');

    const res = await app.inject({
      method: 'POST',
      url: '/upload',
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('UPLOAD_ERROR');
    expect(res.json().message).toBe('Upload failed');
  });
});
