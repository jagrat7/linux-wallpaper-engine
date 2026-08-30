import type { SystemTheme, ThemeScheme } from './system-theme.types'

export interface SystemThemePlatform {
  readScheme(): ThemeScheme
  subscribe(onChange: () => void): () => void
}

// ── System theme service ──────────────────────────────────────────────────

export interface ISystemThemeService {
  configurePlatform(platform: SystemThemePlatform): void

  // Theme query
  getTheme(): Promise<SystemTheme>

  // Theme watching
  startWatching(): void
  stopWatching(): void
}
