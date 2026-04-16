import { createWriteStream, mkdirSync, unlink } from 'fs';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';
import type { MultipartFile } from '@fastify/multipart';
import type { IStorageAdapter, UploadResult } from './storage.interface';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const UPLOAD_DIR = join(process.cwd(), 'uploads');

// Ensure uploads directory exists at module load time
mkdirSync(UPLOAD_DIR, { recursive: true });

export class LocalStorageAdapter implements IStorageAdapter {
  private get baseUrl(): string {
    return (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  }

  async save(part: MultipartFile): Promise<UploadResult> {
    if (!ALLOWED_TYPES.has(part.mimetype)) {
      throw new Error(`Unsupported type: ${part.mimetype}. Allowed: jpeg, png, gif, webp`);
    }

    const ext = extname(part.filename) || `.${part.mimetype.split('/')[1]}`;
    const filename = `${randomUUID()}${ext}`;
    const filePath = join(UPLOAD_DIR, filename);

    let bytesWritten = 0;
    const dest = createWriteStream(filePath);

    for await (const chunk of part.file) {
      bytesWritten += (chunk as Buffer).length;
      if (bytesWritten > MAX_SIZE_BYTES) {
        dest.destroy();
        throw new Error(`File exceeds ${MAX_SIZE_BYTES / 1024 / 1024}MB limit`);
      }
      dest.write(chunk);
    }

    await new Promise<void>((resolve, reject) => {
      dest.end();
      dest.on('finish', resolve);
      dest.on('error', reject);
    });

    return {
      filename,
      url: `${this.baseUrl}/uploads/${filename}`,
    };
  }

  async delete(filename: string): Promise<void> {
    const filePath = join(UPLOAD_DIR, filename);
    await new Promise<void>((resolve) => {
      unlink(filePath, () => resolve()); // ignore ENOENT
    });
  }
}
