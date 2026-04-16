import { PrismaClient } from '@prisma/client';
import { createHmac, randomBytes } from 'crypto';

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = createHmac('sha256', salt).update(password).digest('hex');
  return `${salt}:${hash}`;
}

async function main(): Promise<void> {
  // Admin user
  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      name: 'Admin',
      email: 'admin@example.com',
      passwordHash: hashPassword('Admin1234'),
      role: 'ADMIN',
      department: 'IT',
    },
  });

  // Regular user
  await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {},
    create: {
      name: 'Test User',
      email: 'user@example.com',
      passwordHash: hashPassword('User1234'),
      role: 'USER',
      department: 'Engineering',
    },
  });

  // Sample assets
  const assets = [
    { name: 'MacBook Pro 16"', serialNo: 'MBP-001', category: 'LAPTOP', location: 'IT', description: 'M3 Pro 18GB' },
    { name: 'Dell Monitor 27"', serialNo: 'MON-001', category: 'MONITOR', location: 'Engineering', description: '4K USB-C' },
    { name: 'Cisco Switch', serialNo: 'NET-001', category: 'HIGH_VALUE', location: 'IT', description: '48-port gigabit' },
  ];

  for (const asset of assets) {
    await prisma.asset.upsert({
      where: { serialNo: asset.serialNo },
      update: {},
      create: { ...asset, status: 'AVAILABLE', holderId: null },
    });
  }

  console.log('Seed completed');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
