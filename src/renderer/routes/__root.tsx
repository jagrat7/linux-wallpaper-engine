import { Outlet, createRootRoute } from '@tanstack/react-router'
import { ThemeProvider } from '@/components/theme-provider'
import { AppShell } from '@/components/layout/app-shell'
import { WallpaperSearchProvider } from '@/contexts/wallpaper-search-context'
import { WorkshopSearchProvider } from '@/contexts/workshop-search-context'

export const Route = createRootRoute({
  component: () => (
    <ThemeProvider defaultMode="system" storageKey="wallpaper-engine-theme">
      <WallpaperSearchProvider>
        <WorkshopSearchProvider>
          <AppShell>
            <Outlet />
          </AppShell>
        </WorkshopSearchProvider>
      </WallpaperSearchProvider>
    </ThemeProvider>
  ),
})
