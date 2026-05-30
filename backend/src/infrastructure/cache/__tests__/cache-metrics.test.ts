import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordCacheHit,
  recordCacheMiss,
  getCacheMetrics,
  resetCacheMetrics,
} from '../cache-metrics';

describe('cache-metrics', () => {
  beforeEach(() => {
    resetCacheMetrics();
  });

  it('starts with zero hits and zero misses across all namespaces', () => {
    const metrics = getCacheMetrics();
    expect(metrics).toHaveLength(7);
    for (const m of metrics) {
      expect(m.hit).toBe(0);
      expect(m.miss).toBe(0);
      expect(Number.isNaN(m.hitRate)).toBe(true);
    }
  });

  it('records hits and misses per namespace and computes hit rate', () => {
    recordCacheHit('assets');
    recordCacheHit('assets');
    recordCacheMiss('assets');
    recordCacheMiss('user');

    const metrics = getCacheMetrics();
    const assets = metrics.find((m) => m.namespace === 'assets')!;
    const user = metrics.find((m) => m.namespace === 'user')!;

    expect(assets.hit).toBe(2);
    expect(assets.miss).toBe(1);
    expect(assets.hitRate).toBeCloseTo(2 / 3, 5);

    expect(user.hit).toBe(0);
    expect(user.miss).toBe(1);
    expect(user.hitRate).toBe(0);
  });

  it('resets metrics back to zero', () => {
    recordCacheHit('unread');
    resetCacheMetrics();
    const unread = getCacheMetrics().find((m) => m.namespace === 'unread')!;
    expect(unread.hit).toBe(0);
    expect(unread.miss).toBe(0);
  });
});
