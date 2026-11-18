// The Sidebar container itself is `fixed` to the window's left edge, so it can't sit in a panel:
// this shows what goes inside it, on the sidebar's colours, the way side-bar.tsx builds it.

import { Download, ListVideo, Monitor, Settings } from 'lucide-react'

import { SteamIcon } from '@/components/icons/steam'
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '@/components/ui/sidebar'

import { Row, Rows, type DemoMeta } from '../demo'

export const meta: DemoMeta = { title: 'Sidebar', components: ['sidebar'] }

const ITEMS = [
  { icon: Download, label: 'Installed' },
  { icon: SteamIcon, label: 'Workshop' },
  { icon: ListVideo, label: 'Playlists' },
  { icon: Monitor, label: 'Displays' },
]

export default function SidebarDemo() {
  return (
    <Rows>
      <Row label="collapsed">
        <SidebarProvider className="min-h-0 w-auto bg-transparent">
          <div className="bg-sidebar text-sidebar-foreground flex h-72 w-(--sidebar-width-icon) flex-col rounded-md border">
            <SidebarHeader className="h-12 items-center justify-center border-b">LWE</SidebarHeader>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {ITEMS.map(({ icon: Icon, label }, i) => (
                      <SidebarMenuItem key={label}>
                        <SidebarMenuButton isActive={i === 0} tooltip={label} aria-label={label}>
                          <Icon />
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Settings" aria-label="Settings">
                    <Settings />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarFooter>
          </div>
        </SidebarProvider>
      </Row>
      <Row label="button">
        <SidebarProvider className="min-h-0 w-auto gap-2 bg-transparent">
          <SidebarMenuButton aria-label="Installed">
            <Download />
          </SidebarMenuButton>
          <SidebarMenuButton isActive aria-label="Installed">
            <Download />
          </SidebarMenuButton>
          <SidebarMenuButton variant="outline" aria-label="Installed">
            <Download />
          </SidebarMenuButton>
          <SidebarMenuButton disabled aria-label="Installed">
            <Download />
          </SidebarMenuButton>
        </SidebarProvider>
      </Row>
    </Rows>
  )
}
