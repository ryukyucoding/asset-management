import { createHmac, randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import type { IUserRepository } from '@domain/repositories/user.repository.interface';
import type { UserEntity } from '@domain/entities/user.entity';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';

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

export function signAccessToken(payload: { userId: string; role: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function signRefreshToken(payload: { userId: string }): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): { userId: string; role: string } {
  return jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
}

export function verifyRefreshToken(token: string): { userId: string } {
  return jwt.verify(token, JWT_REFRESH_SECRET) as { userId: string };
}

export class AuthService {
  constructor(private readonly userRepo: IUserRepository) {}

  async login(email: string, password: string): Promise<{ accessToken: string; refreshToken: string; user: Omit<UserEntity, 'passwordHash'> }> {
    const user = await this.userRepo.findByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new Error('Invalid credentials');
    }

    const accessToken = signAccessToken({ userId: user.id, role: user.role });
    const refreshToken = signRefreshToken({ userId: user.id });
    const { passwordHash: _, ...publicUser } = user;

    return { accessToken, refreshToken, user: publicUser };
  }

  async register(data: { name: string; email: string; password: string; department?: string }): Promise<Omit<UserEntity, 'passwordHash'>> {
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
