import { createHmac, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { IUserRepository } from '@domain/repositories/user.repository.interface';
import type { ITokenStore } from '@domain/repositories/token-store.interface';
import type { UserEntity, UserRole } from '@domain/entities/user.entity';
import { RedisTokenStore } from '@infrastructure/cache/redis-token.store';
import { parseDurationToSeconds } from '@infrastructure/cache/redis.client';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';

const ACCESS_TTL_SECONDS = parseDurationToSeconds(JWT_EXPIRES_IN);
const REFRESH_TTL_SECONDS = parseDurationToSeconds(JWT_REFRESH_EXPIRES_IN);

export function createJti(): string {
  return randomBytes(16).toString('hex');
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = createHmac('sha256', salt).update(password).digest('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  const attempt = createHmac('sha256', salt).update(password).digest('hex');
  return attempt === hash;
}

export function signAccessToken(payload: { userId: string; role: UserRole; jti?: string }): string {
  const jti = payload.jti ?? createJti();
  return jwt.sign(
    { userId: payload.userId, role: payload.role, jti },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions,
  );
}

export function signRefreshToken(payload: { userId: string; jti?: string }): string {
  const jti = payload.jti ?? createJti();
  return jwt.sign(
    { userId: payload.userId, jti },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions,
  );
}

export function verifyAccessToken(token: string): { userId: string; role: UserRole; jti: string } {
  return jwt.verify(token, JWT_SECRET) as { userId: string; role: UserRole; jti: string };
}

export function verifyRefreshToken(token: string): { userId: string; jti: string } {
  return jwt.verify(token, JWT_REFRESH_SECRET) as { userId: string; jti: string };
}

export class AuthService {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly tokenStore: ITokenStore = new RedisTokenStore(),
  ) {}

  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: Omit<UserEntity, 'passwordHash'> }> {
    const user = await this.userRepo.findByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new Error('Invalid credentials');
    }

    const accessJti = createJti();
    const refreshJti = createJti();
    const accessToken = signAccessToken({ userId: user.id, role: user.role, jti: accessJti });
    const refreshToken = signRefreshToken({ userId: user.id, jti: refreshJti });

    try {
      await this.tokenStore.storeRefreshToken(user.id, refreshJti, REFRESH_TTL_SECONDS);
    } catch {
      // Redis unavailable: tokens still work until expiry (degraded session mode).
    }

    const { passwordHash: _, ...publicUser } = user;
    return { accessToken, refreshToken, user: publicUser };
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string }> {
    let payload: { userId: string; jti: string };
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new Error('Invalid refresh token');
    }

    let sessionValid = false;
    try {
      sessionValid = await this.tokenStore.hasRefreshToken(payload.userId, payload.jti);
    } catch {
      sessionValid = true;
    }
    if (!sessionValid) {
      throw new Error('Invalid refresh token');
    }

    const user = await this.userRepo.findById(payload.userId);
    if (!user) {
      throw new Error('Invalid refresh token');
    }

    const accessToken = signAccessToken({ userId: user.id, role: user.role });
    return { accessToken };
  }

  async logout(userId: string, accessJti: string): Promise<void> {
    try {
      await this.tokenStore.denyAccessToken(accessJti, ACCESS_TTL_SECONDS);
      await this.tokenStore.revokeAllRefreshTokens(userId);
    } catch {
      // Logout is best-effort when Redis is down.
    }
  }

  async register(data: {
    name: string;
    email: string;
    password: string;
    department?: string;
  }): Promise<Omit<UserEntity, 'passwordHash'>> {
    const existing = await this.userRepo.findByEmail(data.email);
    if (existing) throw new Error('Email already registered');

    const passwordHash = hashPassword(data.password);
    const user = await this.userRepo.create({
      name: data.name,
      email: data.email,
      department: data.department,
      passwordHash,
    });
    const { passwordHash: _, ...publicUser } = user;
    return publicUser;
  }
}

export async function isAccessTokenDenied(jti: string): Promise<boolean> {
  const store = new RedisTokenStore();
  try {
    return await store.isAccessTokenDenied(jti);
  } catch {
    return false;
  }
}
