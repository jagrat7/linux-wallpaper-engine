import { Trash2 } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

import { Row, Rows, type DemoMeta } from '../demo'

export const meta: DemoMeta = { title: 'Alert dialog', components: ['alert-dialog'] }

export default function AlertDialogDemo() {
  return (
    <Rows>
      <Row label="default">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">Delete playlist</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogMedia>
                <Trash2 />
              </AlertDialogMedia>
              <AlertDialogTitle>Delete “Evening rotation”?</AlertDialogTitle>
              <AlertDialogDescription>
                The playlist is removed from Wallpaper Engine as well. Its wallpapers stay
                installed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Row>
      <Row label="sm">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline">Stop all</Button>
          </AlertDialogTrigger>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Stop every wallpaper?</AlertDialogTitle>
              <AlertDialogDescription>
                All screens go back to their desktop background.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction>Stop</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Row>
    </Rows>
  )
}
