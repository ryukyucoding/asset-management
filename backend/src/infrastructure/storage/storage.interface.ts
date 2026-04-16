import type { MultipartFile } from '@fastify/multipart';

export interface UploadResult {
  filename: string;
  url: string;
}

export interface IStorageAdapter {
  /**
   * Save an uploaded file and return its public URL.
   */
  save(file: MultipartFile): Promise<UploadResult>;

  /**
   * Delete a file by its filename (not full URL).
   * Implementations should be idempotent — no error if the file doesn't exist.
   */
  delete(filename: string): Promise<void>;
}
