import { Outlet, createRootRoute } from '@tanstack/react-router'
import { ThemeProvider } from '@/components/theme-provider'
import { AppShell } from '@/components/layout/app-shell'
import { SearchProvider } from '@/contexts/search-context'

export const Route = createRootRoute({
  component: () => (
    <ThemeProvider defaultMode="dark" storageKey="wallpaper-engine-theme">
      <SearchProvider>
        <AppShell>
          <Outlet />
        </AppShell>
      </SearchProvider>
    </ThemeProvider>
  ),
})
