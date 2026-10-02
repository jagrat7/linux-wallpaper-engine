import { createTRPCReact } from '@trpc/react-query'
import { createWSClient, wsLink, type TRPCLink } from '@trpc/client'
import { observable } from '@trpc/server/observable'
import { isElectronRenderer } from './platform'
import { DEV_API_PATH } from '../../shared/constants/development'
import { ipcLink } from 'trpc-electron/renderer'
import { QueryClient } from '@tanstack/react-query'
import type { AppRouter } from '../../main/trpc/router'

export const trpc = createTRPCReact<AppRouter>()

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 seconds
      refetchOnWindowFocus: true, // Refetch when window gains focus
    },
  },
})

const wsClient = isElectronRenderer()
  ? null
  : createWSClient({
      url: () =>
        `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}${DEV_API_PATH}`,
      onOpen: () => {
        void queryClient.invalidateQueries()
      },
    })

// Browser window actions belong to this tab, never another native window.
const browserWindowLink: TRPCLink<AppRouter> =
  () =>
  ({ op, next }) => {
    if (op.path === 'window.openExternal' || op.path === 'window.maximize') {
      return observable((observer) => {
        if (op.path === 'window.openExternal') {
          const input = op.input as { url: string }
          const url = new URL(input.url)
          if (url.protocol === 'https:' || url.protocol === 'http:') {
            window.open(url.href, '_blank', 'noopener,noreferrer')
          }
        }
        observer.next({ result: { data: { success: true } } })
        observer.complete()
      })
    }
    return next(op)
  }

export const trpcClient = trpc.createClient({
  links: wsClient ? [browserWindowLink, wsLink({ client: wsClient })] : [ipcLink()],
})

if (import.meta.hot) import.meta.hot.dispose(() => wsClient?.close())
if (wsClient) window.addEventListener('pagehide', () => wsClient.close(), { once: true })
