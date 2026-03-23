import { app } from 'electron'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { isFlatpak, getFlatpakID } from './flatpak'

const BINARY_NAME = 'linux-wallpaper-engine';

const getDesktopFilePath = (): string => {
  const autostartDir = path.join(app.getPath('home'), '.config', 'autostart')
  return path.join(autostartDir, `${app.getName()}.desktop`)
}

const isBinaryInPath = (): boolean => {
  const systemPaths = (process.env.PATH || '').split(path.delimiter);
  for (const dir of systemPaths) {
    const fullPath = path.join(dir, BINARY_NAME);
    if (fs.existsSync(fullPath)) {
      return true;
    }
  }
  return false;
}

const getLinuxExec = (): string => {
  // If flatpak, run via the host command
  if (isFlatpak())
    return `flatpak run ${getFlatpakID()}`;

  // If in PATH, use the binary name
  if (isBinaryInPath())
    return BINARY_NAME;

  // If wrapped with electron, wrap the app path command
  if (path.basename(process.execPath).toLowerCase().includes('electron'))
    return `"${process.execPath}" "${app.getAppPath()}"`;

  return `"${process.execPath}"`;
}

/**
 * Write / delete the autostart desktop entry
 */
export const setAutostart = (enabled: boolean | undefined): void => {
  if (enabled === undefined) return

  // If MacOS
  if (process.platform === 'darwin') {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      path: process.execPath,
    });
    return;
  }

  // If Linux
  const desktopFile = getDesktopFilePath();

  if (!enabled) {
    if (fs.existsSync(desktopFile)) {
      fs.unlinkSync(desktopFile);
    }
    return;
  }

  const dir = path.dirname(desktopFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const content = [
    '[Desktop Entry]',
    'Type=Application',
    `Name=${app.getName()}`,
    `Comment=Launch Linux Wallpaper Engine on startup`,
    `Icon=${BINARY_NAME}`,
    `Exec=${getLinuxExec()}`,
    'Terminal=false',
    'StartupNotify=false',
    'X-GNOME-Autostart-enabled=true',
    'X-KDE-autostart-after=panel',
  ];

  if (isFlatpak())
    content.push(`X-Flatpak=${getFlatpakID()}`)

  try {
    fs.writeFileSync(desktopFile, content.join('\n') + '\n')
  } catch (err) {
    console.error('Failed to write autostart entry:', err)
  }
}
