import type { IStorageAdapter } from './storage.interface';
import { LocalStorageAdapter } from './local-storage.adapter';
import { GCSStorageAdapter } from './gcs-storage.adapter';

/**
 * Returns the correct storage adapter based on STORAGE_DRIVER env var.
 *
 * STORAGE_DRIVER=local  (default) → LocalStorageAdapter  (files saved to ./uploads/)
 * STORAGE_DRIVER=gcs              → GCSStorageAdapter     (files saved to GCS bucket)
 */
export function createStorageAdapter(): IStorageAdapter {
  const driver = process.env.STORAGE_DRIVER ?? 'local';

  switch (driver) {
    case 'gcs':
      return new GCSStorageAdapter();
    case 'local':
    default:
      return new LocalStorageAdapter();
  }
}

// Singleton — created once at startup
export const storageAdapter: IStorageAdapter = createStorageAdapter();
