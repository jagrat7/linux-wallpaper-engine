export const DEV_API_PATH = '/api/trpc'
export const DEV_MEDIA_PATH = '/api/media'
export const DEV_HEALTH_PATH = '/api/health'
export const DEV_READY_PREFIX = 'LWE_DEV_READY '
export const DEV_WEB_READY_PREFIX = 'LWE_WEB_READY '
// Finished browser runs keep their backend bundle and fixture data for inspection.
export const DEV_RETAINED_RUNS = 10

export interface DevWebReady {
  url: string
  port: number
  backendPort: number
  dataDirectory: string
  buildDirectory: string
  cacheDirectory: string
}
