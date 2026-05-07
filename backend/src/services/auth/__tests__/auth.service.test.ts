import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService, hashPassword, verifyPassword, signAccessToken, verifyAccessToken } from '../auth.service';
import type { IUserRepository } from '@domain/repositories/user.repository.interface';
import type { UserEntity } from '@domain/entities/user.entity';

const mockUser: UserEntity = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  passwordHash: hashPassword('password123'),
  role: 'USER',
  department: 'IT',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockRepo: IUserRepository = {
  findById: vi.fn(),
  findByEmail: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
};

describe('hashPassword / verifyPassword', () => {
  it('hashes and verifies a correct password', () => {
    const hash = hashPassword('mypassword');
    expect(verifyPassword('mypassword', hash)).toBe(true);
  });

  it('rejects a wrong password', () => {
    const hash = hashPassword('mypassword');
    expect(verifyPassword('wrongpassword', hash)).toBe(false);
  });

  it('generates unique hashes for same password', () => {
    const h1 = hashPassword('same');
    const h2 = hashPassword('same');
    expect(h1).not.toBe(h2);
  });
});

describe('JWT tokens', () => {
  it('signs and verifies an access token', () => {
    const payload = { userId: 'u1', role: 'USER' };
    const token = signAccessToken(payload);
    const decoded = verifyAccessToken(token);
    expect(decoded.userId).toBe('u1');
    expect(decoded.role).toBe('USER');
  });

  it('throws on invalid token', () => {
    expect(() => verifyAccessToken('invalid.token.here')).toThrow();
  });
});

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(mockRepo);
  });

  describe('login', () => {
    it('returns tokens and user on valid credentials', async () => {
      vi.mocked(mockRepo.findByEmail).mockResolvedValue(mockUser);

      const result = await service.login('test@example.com', 'password123');

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.email).toBe('test@example.com');
      expect((result.user as Record<string, unknown>).passwordHash).toBeUndefined();
    });

    it('throws on user not found', async () => {
      vi.mocked(mockRepo.findByEmail).mockResolvedValue(null);
      await expect(service.login('x@x.com', 'pass')).rejects.toThrow('Invalid credentials');
    });

    it('throws on wrong password', async () => {
      vi.mocked(mockRepo.findByEmail).mockResolvedValue(mockUser);
      await expect(service.login('test@example.com', 'wrongpass')).rejects.toThrow('Invalid credentials');
    });
  });

  describe('register', () => {
    it('creates and returns user without passwordHash', async () => {
      vi.mocked(mockRepo.findByEmail).mockResolvedValue(null);
      vi.mocked(mockRepo.create).mockResolvedValue(mockUser);

      const result = await service.register({ name: 'Test', email: 'test@example.com', password: 'pass123' });

      expect(result.email).toBe('test@example.com');
      expect((result as Record<string, unknown>).passwordHash).toBeUndefined();
      expect(mockRepo.create).toHaveBeenCalledWith({
        name: 'Test',
        email: 'test@example.com',
        department: undefined,
        passwordHash: expect.any(String),
      });
    });

    it('throws if email already registered', async () => {
      vi.mocked(mockRepo.findByEmail).mockResolvedValue(mockUser);
      await expect(service.register({ name: 'Test', email: 'test@example.com', password: 'pass' }))
        .rejects.toThrow('Email already registered');
    });
  });
});
