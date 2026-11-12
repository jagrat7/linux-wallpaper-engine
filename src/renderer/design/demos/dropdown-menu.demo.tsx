import { useState } from 'react'
import { ArrowDownUp, ChevronDown, ExternalLink, FolderOpen, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { Row, Rows, type DemoMeta } from '../demo'

export const meta: DemoMeta = { title: 'Dropdown menu', components: ['dropdown-menu'] }

export default function DropdownMenuDemo() {
  const [sort, setSort] = useState('name')
  const [scenes, setScenes] = useState(true)
  return (
    <Rows>
      <Row label="actions">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              Wallpaper
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Aurora Borealis</DropdownMenuLabel>
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <FolderOpen />
                Open folder
                <DropdownMenuShortcut>⌘O</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <ExternalLink />
                View on Workshop
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Apply to</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem>DP-1</DropdownMenuItem>
                  <DropdownMenuItem>HDMI-A-1</DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">
              <Trash2 />
              Unsubscribe
            </DropdownMenuItem>
            <DropdownMenuItem disabled>Disabled item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Row>
      <Row label="choices">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <ArrowDownUp />
              Sort and filter
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={sort} onValueChange={setSort}>
              <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="date">Date added</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="size">File size</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem checked={scenes} onCheckedChange={setScenes}>
              Scenes
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Row>
    </Rows>
  )
}
