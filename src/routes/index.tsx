import { createFileRoute } from '@tanstack/react-router'
import { ThemeToggle } from '@/components/theme-toggle'
import { Cog } from '@/components/ui/cog'

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="text-center">
        <div className="flex items-center justify-center gap-4">
          <Cog className="h-24 w-24 text-primary" />
          <h1 className="text-6xl font-bold tracking-wider text-primary">
            Linux Wallpaper Engine
          </h1>
          <Cog className="h-24 w-24 text-primary" />
        </div>
        <div className="my-8 h-px w-full bg-border" />
        <p className="text-2xl text-muted-foreground">
          Your Electron app is now infused with steam energy!
        </p>
      </div>
    </div>
  )
}
