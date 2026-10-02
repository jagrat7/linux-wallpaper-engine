// This entry is bundled into native code only. Packaged apps never honor dev flags.
import { app } from 'electron'

export const isBrowserDev = process.env.LWE_DEV_WEB === '1' && !app.isPackaged
export const isFixtureMode = isBrowserDev && process.env.LWE_DEV_FIXTURES === '1'
export const isolatedDataDirectory = isBrowserDev ? process.env.LWE_DEV_DATA_DIR : undefined
