import { useNavigate, useRouterState } from "@tanstack/react-router"
import type { ElementType } from "react"
import {
    Download,
    ListVideo,
    Monitor,
    Settings,
} from "lucide-react"
import { SteamIcon } from "@/components/icons/steam"
import logoImage from "../../../../assets/transparent-logo.png"
import {
    Sidebar as SidebarPrimitive,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { useTheme } from "../theme-provider"
import { KeyboardShortcut } from "@/components/keyboard-shortcut"
import { getAriaKeyShortcut, type KeyboardShortcutId } from "@/lib/keyboard-shortcuts"
import { AppKeyboardShortcuts } from "@/components/app-keyboard-shortcuts"

const navItems = [
    { to: "/", icon: Download, label: "Installed", shortcut: "installed" },
    { to: "/workshop", icon: SteamIcon, label: "Workshop", shortcut: "workshop" },
    { to: "/playlists", icon: ListVideo, label: "Playlists", shortcut: "playlists" },
    { to: "/displays", icon: Monitor, label: "Displays", shortcut: "displays" },
    { to: "/settings", icon: Settings, label: "Settings", shortcut: "settings" },
] as const satisfies ReadonlyArray<{ to: string, icon: ElementType, label: string, shortcut: KeyboardShortcutId }>

interface SidebarProps {
    className?: string
}

export function Sidebar({ className }: SidebarProps) {
    const router = useRouterState()
    const navigate = useNavigate()
    const currentPath = router.location.pathname
    const isLightTheme = useTheme().mode.includes("light")
    return (
        <SidebarPrimitive collapsible="icon" className={cn("", className)}>
            <SidebarHeader className="gap-0 p-0">
                <div className="flex h-12 items-center justify-center border-b border-border/65 px-2 group-data-[collapsible=icon]:px-0">
                    <div className={cn("flex items-center justify-center shrink-0 rounded-md p-1", isLightTheme && "invert-[0.1]")}>
                        <img
                            src={logoImage}
                            alt="Wallpaper Engine Logo"
                            className="size-7 object-contain"
                        />
                    </div>
                </div>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {navItems.map((item) => {
                                const isActive = currentPath === item.to
                                return (
                                    <SidebarMenuItem key={item.to}>
                                        <SidebarMenuButton aria-keyshortcuts={getAriaKeyShortcut(item.shortcut)} isActive={isActive} tooltip={item.label} onClick={() => navigate({ to: item.to })}>
                                            <item.icon className="size-4" />
                                            <span>{item.label}</span>
                                            <KeyboardShortcut shortcut={item.shortcut} className="ml-auto group-data-[collapsible=icon]:hidden" />
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                )
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="group-data-[collapsible=icon]:hidden">
                <div className="p-2">
                    <AppKeyboardShortcuts />
                    <div className="text-xs text-muted-foreground">
                        <p>linux-wallpaperengine</p>
                        <p className="mt-0.5 opacity-60">v1.0.0</p>
                    </div>
                </div>
            </SidebarFooter>
        </SidebarPrimitive>
    )
}
