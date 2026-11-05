import { app } from 'electron'
import { pageFromArgv } from './launch'

// Imported before services: exit immediately so a duplicate launch cannot
// initialize stores, restore wallpapers, or create a second window.
// Chromium can reorder argv on Linux; send the parsed page as structured data.
if (!app.requestSingleInstanceLock({ page: pageFromArgv(process.argv) ?? null })) app.exit(0)
