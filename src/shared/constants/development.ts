export const DEV_API_PATH = '/api/trpc'
export const DEV_MEDIA_PATH = '/api/media'
export const DEV_HEALTH_PATH = '/api/health'
export const DEV_READY_PREFIX = 'LWE_DEV_READY '

export interface DevWebReady {
  url: string
  port: number
  backendPort: number
  dataDirectory: string
  buildDirectory: string
}
