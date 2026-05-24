import { createWriteStream, mkdirSync, unlink } from 'fs';
import { pipeline } from 'stream/promises';
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
  async save(part: MultipartFile): Promise<UploadResult> {
    if (!ALLOWED_TYPES.has(part.mimetype)) {
      throw new Error(`Unsupported type: ${part.mimetype}. Allowed: jpeg, png, gif, webp`);
    }

    const ext = extname(part.filename) || `.${part.mimetype.split('/')[1]}`;
    const filename = `${randomUUID()}${ext}`;
    const filePath = join(UPLOAD_DIR, filename);

    let bytesWritten = 0;
    const dest = createWriteStream(filePath);
    const limitStream = async function* (source: AsyncIterable<Buffer>) {
      for await (const chunk of source) {
        bytesWritten += chunk.length;
        if (bytesWritten > MAX_SIZE_BYTES) {
          throw new Error(`File exceeds ${MAX_SIZE_BYTES / 1024 / 1024}MB limit`);
        }
        yield chunk;
      }
    };

    await pipeline(limitStream(part.file), dest);

    // Relative path — frontend resolves via VITE_API_URL (avoids wrong BASE_URL in dev/deploy)
    return {
      filename,
      url: `/uploads/${filename}`,
    };
  }

  async delete(filename: string): Promise<void> {
    const filePath = join(UPLOAD_DIR, filename);
    await new Promise<void>((resolve) => {
      unlink(filePath, () => resolve()); // ignore ENOENT
    });
  }
}
