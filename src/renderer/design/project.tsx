// What only this project can say about itself, for the design page (page.tsx). The rest the
// page reads from the project's files (sources.ts).

import { THEME_STORAGE_KEY } from '@/components/theme-provider'
import logo from '../../../assets/transparent-logo.png'
import type { DemoModule, Project } from './types'

export const project: Project = {
  name: 'Linux Wallpaper Engine',
  brand: (
    // Hash router: home is #/, not /
    <a href="#/" className="flex items-center gap-2 text-[18px] font-bold tracking-tight">
      <img src={logo} alt="" className="size-7 object-contain" />
      Linux Wallpaper Engine
    </a>
  ),
  editor: (file) => `/__open-in-editor?file=${encodeURIComponent(file)}`,
  uiImport: '@/components/ui',
  demos: Object.values(import.meta.glob<DemoModule>('./demos/*.demo.tsx', { eager: true })),
  // theme-provider.tsx: a theme class on <html>, the choice in localStorage. The page writes
  // light or dark there, both of which the app takes
  theme: { dark: { class: 'dark' }, storageKey: THEME_STORAGE_KEY },

  roles: [
    { name: 'Background', token: 'background', use: 'bg-background · glass' },
    { name: 'Surface', token: 'card', use: 'bg-card · bg-popover' },
    { name: 'Subtle', token: 'muted', use: 'bg-muted · bg-secondary · bg-accent' },
    { name: 'Line', token: 'border', use: 'border-border · scrollbar-styled' },
    { name: 'Field', token: 'input', use: 'border-input' },
    { name: 'Muted', token: 'muted-foreground', use: 'text-muted-foreground' },
    { name: 'Ink', token: 'foreground', use: 'text-foreground' },
    { name: 'Primary', token: 'primary', use: 'bg-primary' },
    { name: 'Success', token: 'success', use: 'bg-success · text-success' },
    { name: 'Warning', token: 'warning', use: 'bg-warning · text-warning' },
    { name: 'Danger', token: 'destructive', use: 'bg-destructive · text-destructive' },
    { name: 'Focus', token: 'ring', use: 'ring-ring · outline-ring/50' },
  ],

  // page-header.tsx, settings-section.tsx, empty-state.tsx, debug-log-dialog.tsx
  typography: [
    { name: 'page title', classes: 'text-2xl font-bold' },
    { name: 'section title', classes: 'font-semibold' },
    { name: 'body', classes: 'text-base' },
    { name: 'description', classes: 'text-sm text-muted-foreground' },
    { name: 'log', classes: 'font-mono text-xs text-muted-foreground' },
  ],
  specimens: {
    'page title': { text: 'Installed' },
    'section title': { text: 'Playback' },
    body: { text: 'Browse, manage, and apply your wallpapers.' },
    description: { text: 'Pause wallpapers while a window is fullscreen' },
    log: { text: 'linux-wallpaperengine --screen-root DP-1 --fps 30' },
  },
}
