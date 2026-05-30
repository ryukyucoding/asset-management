import { Queue, Worker, type Job } from 'bullmq';
import { NotificationRepository } from '@infrastructure/repositories/notification.repository';
import { UserRepository } from '@infrastructure/repositories/user.repository';
import { CachedUserRepository } from '@infrastructure/repositories/cached-user.repository';
import { NotificationService } from '@services/notification/notification.service';

export const NOTIFICATION_QUEUE_NAME = 'notification-jobs';

export type NotificationJobPayload =
  | { type: 'APPLICATION_SUBMITTED'; assetName: string }
  | { type: 'APPLICATION_REJECTED'; userId: string; assetName: string; comment?: string }
  | { type: 'APPLICATION_APPROVED'; userId: string; assetName: string }
  | { type: 'REPAIR_COMPLETED'; userId: string; assetName: string };

let notificationQueue: Queue<NotificationJobPayload> | null = null;
let notificationWorker: Worker<NotificationJobPayload> | null = null;

function getConnectionOptions() {
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const parsed = new URL(redisUrl);
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    maxRetriesPerRequest: null as null,
  };
}

export function getNotificationQueue(): Queue<NotificationJobPayload> {
  if (!notificationQueue) {
    notificationQueue = new Queue<NotificationJobPayload>(NOTIFICATION_QUEUE_NAME, {
      connection: getConnectionOptions(),
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    });
  }
  return notificationQueue;
}

async function processNotificationJob(job: Job<NotificationJobPayload>): Promise<void> {
  const service = new NotificationService(
    new NotificationRepository(),
    new CachedUserRepository(new UserRepository()),
  );
  const { data } = job;

  switch (data.type) {
    case 'APPLICATION_SUBMITTED':
      await service.notifyApplicationSubmitted(data.assetName);
      break;
    case 'APPLICATION_REJECTED':
      await service.notifyApplicationRejected(data.userId, data.assetName, data.comment);
      break;
    case 'APPLICATION_APPROVED':
      await service.notifyApplicationApproved(data.userId, data.assetName);
      break;
    case 'REPAIR_COMPLETED':
      await service.notifyRepairCompleted(data.userId, data.assetName);
      break;
    default:
      break;
  }
}

export async function enqueueNotification(payload: NotificationJobPayload): Promise<void> {
  if (process.env.NODE_ENV === 'test') {
    await processNotificationJob({ data: payload } as Job<NotificationJobPayload>);
    return;
  }

  try {
    await getNotificationQueue().add(payload.type, payload);
  } catch {
    await processNotificationJob({ data: payload } as Job<NotificationJobPayload>);
  }
}

export function startNotificationWorker(): Worker<NotificationJobPayload> | null {
  if (process.env.NODE_ENV === 'test') return null;

  if (!notificationWorker) {
    notificationWorker = new Worker<NotificationJobPayload>(
      NOTIFICATION_QUEUE_NAME,
      processNotificationJob,
      { connection: getConnectionOptions() },
    );
    notificationWorker.on('failed', (job, err) => {
      console.error(`Notification job ${job?.id} failed:`, err);
    });
  }
  return notificationWorker;
}

export async function closeNotificationQueue(): Promise<void> {
  if (notificationWorker) {
    await notificationWorker.close();
    notificationWorker = null;
  }
  if (notificationQueue) {
    await notificationQueue.close();
    notificationQueue = null;
  }
}
