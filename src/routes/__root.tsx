import { Outlet, createRootRoute } from '@tanstack/react-router'
import { ThemeProvider } from '@/components/theme-provider'

export const Route = createRootRoute({
  component: () => (
    <ThemeProvider defaultTheme="steam" storageKey="wallpaper-engine-theme">
      <Outlet />
    </ThemeProvider>
  ),
})
