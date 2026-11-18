import { Outlet, createRootRoute, useRouterState } from '@tanstack/react-router'
import { ThemeProvider } from '@/components/theme-provider'
import { AppShell } from '@/components/layout/app-shell'
import { WallpaperSearchProvider } from '@/contexts/wallpaper-search-context'
import { WorkshopSearchProvider } from '@/contexts/workshop-search-context'

export const Route = createRootRoute({ component: RootLayout })

function RootLayout() {
  // The dev-only design page (routes/design.tsx) is a page of its own: outside the app's shell,
  // and outside ThemeProvider, whose theme class and system palette on <html> would override
  // the page's own light and dark. In a build /design is not found, like any other unknown path
  const standalone = useRouterState({
    select: (state) => import.meta.env.DEV && state.location.pathname === '/design',
  })
  if (standalone) return <Outlet />
  return (
    <ThemeProvider>
      <WallpaperSearchProvider>
        <WorkshopSearchProvider>
          <AppShell>
            <Outlet />
          </AppShell>
        </WorkshopSearchProvider>
      </WallpaperSearchProvider>
    </ThemeProvider>
  )
}
