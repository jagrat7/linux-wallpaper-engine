import * as React from "react"
import { cn } from "@/lib/utils"
import { Sidebar } from "./side-bar"

import { StatusBar, STATUS_BAR_HEIGHT } from "./bottom-status-bar"
import { SidebarProvider } from "@/components/ui/sidebar"
import { trpc } from "@/lib/trpc"
import { WallpaperBackground } from "@/components/wallpaper/wallpaper-background"
import { UpdateReminderBanner } from "@/components/update-reminder-banner"
import { ScanReminderBanner } from "@/components/scan-reminder-banner"

const MAIN_CONTENT_ID = "main-content"

interface AppShellProps {
    children: React.ReactNode
    className?: string
}

export function AppShell({ children, className }: AppShellProps) {
    const { data: settings } = trpc.settings.get.useQuery()

    return (
        <SidebarProvider defaultOpen={false}>
            <div
                className="relative flex h-screen w-full flex-col overflow-hidden bg-background"
                style={{ "--status-bar-h": settings?.showStatusBar ? STATUS_BAR_HEIGHT : "0rem" } as React.CSSProperties}
            >
                <a
                    href={`#${MAIN_CONTENT_ID}`}
                    onClick={(event) => {
                        event.preventDefault()
                        const main = document.getElementById(MAIN_CONTENT_ID)
                        main?.focus()
                        main?.scrollIntoView({ block: "start" })
                    }}
                    className="absolute left-3 top-3 z-50 -translate-y-16 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-md transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                >
                    Skip to content
                </a>
                {settings?.dynamicBackground && <WallpaperBackground />}
                <div className="relative z-10 flex min-h-0 flex-1">
                    <Sidebar className="z-10" />
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                        <div className="flex flex-col gap-2 px-[2.5%] pt-3 empty:hidden">
                            <UpdateReminderBanner />
                            <ScanReminderBanner />
                        </div>
                        <main
                            id={MAIN_CONTENT_ID}
                            tabIndex={-1}
                            className={cn("min-h-0 flex-1 overflow-auto px-[2.5%] pb-4 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring scrollbar-styled", className)}
                        >
                            {children}
                        </main>
                    </div>
                </div>
                {settings?.showStatusBar && <StatusBar className="z-20 shrink-0" />}
            </div>
        </SidebarProvider>
    )
}
