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
    {
      name: 'MacBook Pro 16"',
      serialNo: 'IT-00000001',
      category: 'IT設備',
      model: 'MacBook Pro 16" M3 Pro',
      spec: 'M3 Pro / 18GB / 512GB SSD',
      supplier: 'Apple Taiwan',
      purchaseDate: new Date('2024-01-15'),
      purchaseCost: 89900,
      location: 'IT 部門',
      assignedDept: 'IT',
      startDate: new Date('2024-02-01'),
      warrantyExpiry: new Date('2027-01-15'),
      description: 'M3 Pro 18GB 主力開發機',
    },
    {
      name: 'Dell Monitor 27"',
      serialNo: 'OFC-00000001',
      category: '辦公設備',
      model: 'Dell UltraSharp U2723D',
      spec: '27" 4K USB-C 60W',
      supplier: 'Dell Technologies',
      purchaseDate: new Date('2023-08-20'),
      purchaseCost: 18500,
      location: '工程部門',
      assignedDept: 'Engineering',
      startDate: new Date('2023-09-01'),
      warrantyExpiry: new Date('2026-08-20'),
      description: '4K USB-C 外接螢幕',
    },
    {
      name: 'Cisco Switch 48P',
      serialNo: 'HV-00000001',
      category: 'HIGH_VALUE',
      model: 'Catalyst 9200L-48P',
      spec: '48-port PoE+ / 4x10G SFP+',
      supplier: 'Cisco Systems',
      purchaseDate: new Date('2022-06-10'),
      purchaseCost: 125000,
      location: 'Server Room',
      assignedDept: 'IT',
      startDate: new Date('2022-07-01'),
      warrantyExpiry: new Date('2025-06-10'),
      description: '核心網路交換機',
    },
    {
      name: 'HP LaserJet Pro',
      serialNo: 'OFC-00000002',
      category: '辦公設備',
      model: 'HP LaserJet Pro M404dn',
      spec: 'A4 雷射 / 雙面列印 / 網路',
      supplier: 'HP Taiwan',
      purchaseDate: new Date('2023-03-10'),
      purchaseCost: 12000,
      location: '行政部門',
      assignedDept: 'Administration',
      startDate: new Date('2023-03-15'),
      warrantyExpiry: new Date('2026-03-10'),
      description: '行政部門共用印表機',
    },
  ];

  for (const asset of assets) {
    const existing = await prisma.asset.findFirst({ where: { name: asset.name } });
    if (existing) {
      // Delete any other asset that already occupies the target serialNo (e.g. test data)
      await prisma.asset.deleteMany({
        where: { serialNo: asset.serialNo, id: { not: existing.id } },
      });
      await prisma.asset.update({
        where: { id: existing.id },
        data:  { serialNo: asset.serialNo },
      });
    } else {
      // Delete any asset occupying the target serialNo before creating
      await prisma.asset.deleteMany({ where: { serialNo: asset.serialNo } });
      await prisma.asset.create({
        data: { ...asset, status: 'AVAILABLE', holderId: null },
      });
    }
  }

  console.log('Seed completed');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
