export const DEV_API_PATH = '/api/trpc'
export const DEV_MEDIA_PATH = '/api/media'
// Dev backend for browser tabs, started by Electron main during `bun dev` and `bun run dev:full`.
// DEV_BACKEND_PORT in the env overrides it so a second instance (dev/verify/lwe) can run beside the user's.
export const DEV_BACKEND_PORT = 5180
export const devBackendPort = (env: Record<string, string | undefined>) =>
  Number(env.DEV_BACKEND_PORT) || DEV_BACKEND_PORT

// What `electron-forge start` opens, set through DEV_TARGET by the dev scripts in package.json
export const DEV_TARGETS = ['web', 'desktop', 'full'] as const
export type DevTarget = (typeof DEV_TARGETS)[number]
