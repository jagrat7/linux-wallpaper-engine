import type { SystemTheme } from './system-theme.types'

// ── System theme service ──────────────────────────────────────────────────

export interface ISystemThemeService {
  // Theme query
  getTheme(): Promise<SystemTheme>

  // Theme watching
  startWatching(): void
  stopWatching(): void
}
