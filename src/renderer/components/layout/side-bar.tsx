import { Link, useRouterState } from "@tanstack/react-router"
import {
    Download,
    List,
    Monitor,
    Settings,
} from "lucide-react"
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

const navItems = [
    { to: "/", icon: Download, label: "Installed" },
    { to: "/playlists", icon: List, label: "Playlists" },
    { to: "/displays", icon: Monitor, label: "Displays" },
    { to: "/settings", icon: Settings, label: "Settings" },
] as const

interface SidebarProps {
    className?: string
}

export function Sidebar({ className }: SidebarProps) {
    const router = useRouterState()
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
                        <SidebarMenu id="onboarding-sidebar-nav">
                            {navItems.map((item) => {
                                const isActive = currentPath === item.to
                                return (
                                    <SidebarMenuItem key={item.to}>
                                        <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                                            <Link to={item.to}>
                                                <item.icon className="size-4" />
                                                <span>{item.label}</span>
                                            </Link>
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
                    <div className="text-xs text-muted-foreground">
                        <p>linux-wallpaperengine</p>
                        <p className="mt-0.5 opacity-60">v1.0.0</p>
                    </div>
                </div>
            </SidebarFooter>
        </SidebarPrimitive>
    )
}
