import { http } from './http'

export const uploadApi = {
  /**
   * Upload up to 5 images. Returns array of hosted URLs.
   */
  uploadImages: (files: File[]): Promise<{ data: { urls: string[] } }> => {
    const form = new FormData()
    files.forEach((f) => form.append('files', f))
    return http.post('/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}
