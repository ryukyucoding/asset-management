import { UserRepository } from '@infrastructure/repositories/user.repository';
import { CachedUserRepository } from '@infrastructure/repositories/cached-user.repository';
import { getAssetStats } from './asset-stats.cache';

const cachedUsers = new CachedUserRepository(new UserRepository());

/**
 * Fire-and-forget cache warming on app startup.
 * Preloads the most frequently hit cold-miss targets so the first real
 * requests don't pay the DB round-trip.
 *
 * Never blocks startup, never throws.
 */
export function warmCache(): void {
  if (process.env.NODE_ENV === 'test') return;

  void Promise.allSettled([
    cachedUsers.findIdsByRole('ADMIN'),
    cachedUsers.findIdsByRole('SENIOR_ADMIN'),
    cachedUsers.findAll(),
    getAssetStats(),
  ]).then((results) => {
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0) {
      console.warn(`[cache-warmer] ${failed} warm-up task(s) failed (non-fatal)`);
    }
  });
}
