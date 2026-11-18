// The design page: every token and component. Dev only: a build drops the page and its demos
// (the import is behind `import.meta.env.DEV`), and the route answers 404.

import { createFileRoute, notFound } from '@tanstack/react-router'
import { Suspense, lazy } from 'react'

const DesignPage = import.meta.env.DEV ? lazy(() => import('@/design')) : null

export const Route = createFileRoute('/design')({
  loader: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  component: Design,
})

function Design() {
  if (!DesignPage) return null
  return (
    <Suspense>
      <DesignPage />
    </Suspense>
  )
}
