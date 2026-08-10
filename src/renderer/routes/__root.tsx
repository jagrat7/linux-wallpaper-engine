import { Outlet, createRootRoute } from '@tanstack/react-router'
import { ThemeProvider } from '@/components/theme-provider'
import { AppShell } from '@/components/layout/app-shell'
import { WallpaperSearchProvider } from '@/contexts/wallpaper-search-context'
import { WorkshopSearchProvider } from '@/contexts/workshop-search-context'
import { HotkeysProvider } from '@tanstack/react-hotkeys'

export const Route = createRootRoute({
  component: () => (
    <HotkeysProvider defaultOptions={{ hotkey: { conflictBehavior: "replace" } }}>
      <ThemeProvider defaultMode="dark" storageKey="wallpaper-engine-theme">
        <WallpaperSearchProvider>
          <WorkshopSearchProvider>
            <AppShell>
              <Outlet />
            </AppShell>
          </WorkshopSearchProvider>
        </WallpaperSearchProvider>
      </ThemeProvider>
    </HotkeysProvider>
  ),
})
