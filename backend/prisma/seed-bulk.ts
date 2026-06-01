import { PrismaClient, type ApplicationStatus, type AssetStatus } from '@prisma/client';

const prisma = new PrismaClient();

const BULK_SERIAL_PREFIX = 'BULK-';
const BATCH_SIZE = 500;

const CATEGORIES = [
  { category: 'IT設備', prefix: 'IT' },
  { category: '辦公設備', prefix: 'OFC' },
  { category: '實驗器材', prefix: 'LAB' },
  { category: '交通工具', prefix: 'VHC' },
  { category: 'HIGH_VALUE', prefix: 'HV' },
  { category: '其他', prefix: 'GEN' },
] as const;

const LOCATIONS = ['IT 部門', '工程部門', '行政部門', 'Server Room', '實驗室 A', '倉庫'];
const DEPARTMENTS = ['IT', 'Engineering', 'Administration', 'Lab', 'Operations'];

interface Options {
  assetCount: number;
  applicationCount: number;
  clear: boolean;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const opts: Options = { assetCount: 10_000, applicationCount: 1_000, clear: false };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--clear') {
      opts.clear = true;
    } else if (arg === '--assets' && args[i + 1]) {
      opts.assetCount = Math.max(0, Number.parseInt(args[++i], 10));
    } else if (arg === '--applications' && args[i + 1]) {
      opts.applicationCount = Math.max(0, Number.parseInt(args[++i], 10));
    }
  }

  return opts;
}

async function clearBulkData(): Promise<void> {
  console.log('Clearing bulk data (BULK-* assets and related records)...');

  await prisma.approval.deleteMany({
    where: { application: { asset: { serialNo: { startsWith: BULK_SERIAL_PREFIX } } } },
  });
  await prisma.application.deleteMany({
    where: { asset: { serialNo: { startsWith: BULK_SERIAL_PREFIX } } },
  });
  await prisma.auditLog.deleteMany({
    where: { asset: { serialNo: { startsWith: BULK_SERIAL_PREFIX } } },
  });
  const deleted = await prisma.asset.deleteMany({
    where: { serialNo: { startsWith: BULK_SERIAL_PREFIX } },
  });

  console.log(`  Deleted ${deleted.count} bulk assets`);
}

function buildAssetRow(index: number) {
  const cat = CATEGORIES[index % CATEGORIES.length];
  const seq = String(Math.floor(index / CATEGORIES.length) + 1).padStart(8, '0');
  const serialNo = `${BULK_SERIAL_PREFIX}${cat.prefix}-${seq}`;
  const dept = DEPARTMENTS[index % DEPARTMENTS.length];
  const location = LOCATIONS[index % LOCATIONS.length];

  return {
    name: `[BULK] ${cat.category} #${index + 1}`,
    serialNo,
    category: cat.category,
    model: `Model-${index + 1}`,
    spec: `Spec batch ${index + 1}`,
    supplier: 'Bulk Seed Supplier',
    purchaseDate: new Date(2022 + (index % 4), index % 12, (index % 28) + 1),
    purchaseCost: 5_000 + (index % 500) * 100,
    location,
    assignedDept: dept,
    startDate: new Date(2023, index % 12, 1),
    warrantyExpiry: new Date(2027, index % 12, 1),
    status: 'AVAILABLE' as AssetStatus,
    holderId: null,
    description: `Bulk test asset ${index + 1}`,
    imageUrls: [] as string[],
  };
}

async function seedAssets(count: number): Promise<void> {
  console.log(`Seeding ${count} bulk assets (batch size ${BATCH_SIZE})...`);
  const start = Date.now();

  for (let offset = 0; offset < count; offset += BATCH_SIZE) {
    const batchEnd = Math.min(offset + BATCH_SIZE, count);
    const data: ReturnType<typeof buildAssetRow>[] = [];
    for (let i = offset; i < batchEnd; i++) {
      data.push(buildAssetRow(i));
    }
    await prisma.asset.createMany({ data, skipDuplicates: true });
    process.stdout.write(`  ${batchEnd}/${count}\r`);
  }

  console.log(`  Assets done in ${((Date.now() - start) / 1000).toFixed(1)}s`);
}

type AppStatusPlan = {
  status: ApplicationStatus;
  assetStatus: AssetStatus;
};

function planApplicationStatuses(count: number): AppStatusPlan[] {
  const plans: AppStatusPlan[] = [];

  const push = (n: number, status: ApplicationStatus, assetStatus: AssetStatus) => {
    for (let i = 0; i < n; i++) plans.push({ status, assetStatus });
  };

  // ~40% pending, ~20% in repair, ~30% completed, ~10% rejected
  const pending = Math.floor(count * 0.4);
  const inRepair = Math.floor(count * 0.2);
  const completed = Math.floor(count * 0.3);
  const rejected = count - pending - inRepair - completed;

  push(pending, 'PENDING', 'PENDING_REPAIR');
  push(inRepair, 'IN_REPAIR', 'IN_REPAIR');
  push(completed, 'COMPLETED', 'AVAILABLE');
  push(rejected, 'REJECTED', 'AVAILABLE');

  // Fisher–Yates shuffle
  for (let i = plans.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [plans[i], plans[j]] = [plans[j], plans[i]];
  }

  return plans;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function seedApplications(count: number, userId: string): Promise<void> {
  if (count === 0) return;

  console.log(`Seeding ${count} bulk applications...`);

  const bulkAssets = await prisma.asset.findMany({
    where: { serialNo: { startsWith: BULK_SERIAL_PREFIX } },
    select: { id: true, category: true },
  });

  if (bulkAssets.length === 0) {
    console.warn('  No bulk assets found — skip applications');
    return;
  }

  if (count > bulkAssets.length) {
    console.warn(`  Requested ${count} applications but only ${bulkAssets.length} bulk assets — capping`);
    count = bulkAssets.length;
  }

  const selected = shuffle(bulkAssets).slice(0, count);
  const statusPlans = planApplicationStatuses(count);

  const applications = selected.map((asset, i) => ({
    userId,
    assetId: asset.id,
    status: statusPlans[i].status,
    faultDescription: `[BULK] 測試故障描述 #${i + 1} — 設備異常需維修`,
    imageUrls: [] as string[],
    repairDate: null,
    repairContent: null,
    repairSolution: null,
    repairCost: null,
    repairVendor: null,
  }));

  const start = Date.now();
  for (let offset = 0; offset < applications.length; offset += BATCH_SIZE) {
    const batch = applications.slice(offset, offset + BATCH_SIZE);
    await prisma.application.createMany({ data: batch });
    process.stdout.write(`  ${Math.min(offset + BATCH_SIZE, applications.length)}/${applications.length}\r`);
  }
  console.log(`  Applications inserted in ${((Date.now() - start) / 1000).toFixed(1)}s`);

  // Sync asset statuses
  console.log('  Syncing asset statuses...');
  const byAssetStatus = new Map<AssetStatus, string[]>();
  for (let i = 0; i < selected.length; i++) {
    const assetStatus = statusPlans[i].assetStatus;
    const ids = byAssetStatus.get(assetStatus) ?? [];
    ids.push(selected[i].id);
    byAssetStatus.set(assetStatus, ids);
  }

  for (const [status, ids] of byAssetStatus) {
    for (let offset = 0; offset < ids.length; offset += BATCH_SIZE) {
      const chunk = ids.slice(offset, offset + BATCH_SIZE);
      await prisma.asset.updateMany({
        where: { id: { in: chunk } },
        data: { status },
      });
    }
  }
}

async function main(): Promise<void> {
  const opts = parseArgs();
  console.log('Bulk seed options:', opts);

  if (opts.clear) {
    await clearBulkData();
  }

  const user = await prisma.user.findUnique({ where: { email: 'user@example.com' } });
  if (!user) {
    throw new Error('user@example.com not found — run `pnpm db:seed` first');
  }

  if (opts.assetCount > 0) {
    await seedAssets(opts.assetCount);
  }

  if (opts.applicationCount > 0) {
    await seedApplications(opts.applicationCount, user.id);
  }

  const [assetCount, appCount] = await Promise.all([
    prisma.asset.count({ where: { serialNo: { startsWith: BULK_SERIAL_PREFIX } } }),
    prisma.application.count({ where: { asset: { serialNo: { startsWith: BULK_SERIAL_PREFIX } } } }),
  ]);

  console.log(`\nBulk seed completed: ${assetCount} assets, ${appCount} applications (BULK-* only)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
