import type { AxiosResponse } from 'axios'

/** Minimal Axios-shaped mock for vi.mocked(...).mockResolvedValue in component tests. */
export function mockHttpData<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {} as AxiosResponse['headers'],
    config: { headers: {} } as AxiosResponse['config'],
  }
}
