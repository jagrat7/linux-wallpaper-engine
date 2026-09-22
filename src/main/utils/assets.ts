import { app } from 'electron'
import path from 'node:path'

export const resolveAssetPath = (assetName: string): string => {
  // If packaged normally in forge-maker
  if (app.isPackaged) return path.join(process.resourcesPath, 'assets', assetName)

  // If packaged with Nix, the resource path will point to Electron's default,
  // so it needs to point to the app directory, where the assets are copied
  const appPath = app.getAppPath()
  if (appPath.includes('app.asar')) return path.join(path.dirname(appPath), 'assets', assetName)

  // For local dev, relative paths just work
  return path.join(__dirname, '../../assets', assetName)
}
