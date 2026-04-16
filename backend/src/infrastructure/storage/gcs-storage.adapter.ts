import { Storage } from '@google-cloud/storage';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import type { MultipartFile } from '@fastify/multipart';
import type { IStorageAdapter, UploadResult } from './storage.interface';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const UPLOAD_PREFIX = 'uploads/';

/**
 * GCS Storage Adapter
 *
 * Required env vars:
 *   GCS_BUCKET_NAME              — e.g. "my-asset-mgmt-bucket"
 *   GOOGLE_APPLICATION_CREDENTIALS — path to service account JSON key file
 *                                    (not needed on Cloud Run — uses attached SA automatically)
 */
export class GCSStorageAdapter implements IStorageAdapter {
  private storage: Storage;
  private bucketName: string;

  constructor() {
    const bucket = process.env.GCS_BUCKET_NAME;
    if (!bucket) throw new Error('GCS_BUCKET_NAME env var is required when STORAGE_DRIVER=gcs');

    this.bucketName = bucket;
    // When running on Cloud Run the default service account is used automatically.
    // Locally, set GOOGLE_APPLICATION_CREDENTIALS to the path of a service account key JSON.
    this.storage = new Storage();
  }

  async save(part: MultipartFile): Promise<UploadResult> {
    if (!ALLOWED_TYPES.has(part.mimetype)) {
      throw new Error(`Unsupported type: ${part.mimetype}. Allowed: jpeg, png, gif, webp`);
    }

    const ext = extname(part.filename) || `.${part.mimetype.split('/')[1]}`;
    const filename = `${randomUUID()}${ext}`;
    const gcsPath = `${UPLOAD_PREFIX}${filename}`;

    const bucket = this.storage.bucket(this.bucketName);
    const file   = bucket.file(gcsPath);

    let bytesWritten = 0;
    const writeStream = file.createWriteStream({
      resumable: false,
      contentType: part.mimetype,
      metadata: { cacheControl: 'public, max-age=31536000' },
    });

    for await (const chunk of part.file) {
      bytesWritten += (chunk as Buffer).length;
      if (bytesWritten > MAX_SIZE_BYTES) {
        writeStream.destroy();
        throw new Error(`File exceeds ${MAX_SIZE_BYTES / 1024 / 1024}MB limit`);
      }
      writeStream.write(chunk);
    }

    await new Promise<void>((resolve, reject) => {
      writeStream.end();
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    // Public URL (bucket must have "allUsers" viewer IAM or use uniform bucket-level access)
    const url = `https://storage.googleapis.com/${this.bucketName}/${gcsPath}`;

    return { filename, url };
  }

  async delete(filename: string): Promise<void> {
    const gcsPath = `${UPLOAD_PREFIX}${filename}`;
    try {
      await this.storage.bucket(this.bucketName).file(gcsPath).delete();
    } catch {
      // Ignore "file not found" errors
    }
  }
}
