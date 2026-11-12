// What a demo file is, and the row its examples sit in.
//
// To show a component on /design, add `demos/<name>.demo.tsx` with a default export (the
// examples) and a `meta` export. The page finds it on its own.

import type { ReactNode } from 'react'

import { cn } from './ui'

export type { DemoMeta, DemoModule } from './types'

/** Small mono text: labels, values, file names. */
export const DATA = 'font-mono text-[12px] leading-[1.4]'

export function Row({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className="grid grid-cols-[84px_minmax(0,1fr)] items-center gap-3">
      <span className={`${DATA} text-muted-foreground`}>{label}</span>
      <div className={cn('flex min-w-0 flex-wrap items-center gap-2', className)}>{children}</div>
    </div>
  )
}

export function Rows({ children }: { children: ReactNode }) {
  return <div className="grid gap-4">{children}</div>
}
