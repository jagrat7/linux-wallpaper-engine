export const DEV_API_PATH = '/api/trpc'
export const DEV_MEDIA_PATH = '/api/media'
// Dev backend for browser tabs, started by Electron main during `bun dev`
export const DEV_BACKEND_PORT = 5180
// Server-only identity shared by Forge's Vite proxy and its Electron child process.
export const DEV_GATEWAY_TOKEN_ENV = 'LWE_DEV_GATEWAY_TOKEN'
export const DEV_GATEWAY_TOKEN_HEADER = 'x-lwe-dev-session'
