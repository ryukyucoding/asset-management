import { beforeAll } from 'vitest';
import { prisma } from '@infrastructure/database/prisma.client';

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for integration tests');
  }

  await prisma.$connect();
});

export { prisma };
