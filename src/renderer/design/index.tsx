// The design page with this project's sources. The route loads this file lazily, and only in
// development, so a build has none of it.
//
// What this wrapper adds for this app:
// - The app routes on the hash (#/design), which the page's own links and `?theme=` don't
//   expect: an index link (#colour) would leave the page, and `?theme=` lands in the hash, not in
//   location.search. So it scrolls to an index link's target instead, and copies a `?theme=` from
//   the hash to location.search before the page reads it.
// - The route sits outside ThemeProvider (routes/__root.tsx), so <html> has no theme of the
//   site's for the page to start from. It marks <html> dark when the user's choice is a dark one,
//   which the page then takes over.

import { useCallback, useState, type MouseEvent } from 'react'

import { THEME_STORAGE_KEY } from '@/components/theme-provider'
import { DEFAULT_SETTINGS } from '../../shared/constants/app'
import DesignPage from './page'
import { sources } from './sources'

/** A `?theme=` after #/design, moved to where the page looks for it. */
function themeFromHash() {
  const [, query = ''] = location.hash.split('?')
  const theme = new URLSearchParams(query).get('theme')
  if (!theme || new URLSearchParams(location.search).get('theme') === theme) return
  const url = new URL(location.href)
  url.searchParams.set('theme', theme)
  history.replaceState(history.state, '', url)
}

/** Starts the page in light or dark as the user's theme is: Steam is a dark theme, and System
    follows the desktop's scheme. */
function themeFromSite() {
  let mode: string = DEFAULT_SETTINGS.theme
  try {
    mode = localStorage.getItem(THEME_STORAGE_KEY) ?? mode
  } catch {
    // Storage blocked: the default theme.
  }
  const dark =
    mode === 'dark' ||
    mode === 'steam' ||
    (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}

export default function Design() {
  // Before the page's first draw, on every visit: both only set what is already wanted
  useState(() => {
    themeFromHash()
    themeFromSite()
  })

  const scrollToEntry = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const link = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null
    const id = link?.getAttribute('href')?.slice(1)
    if (!id || id.startsWith('/')) return
    const target = document.getElementById(id)
    if (!target) return
    event.preventDefault()
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <div onClickCapture={scrollToEntry}>
      <DesignPage sources={sources} />
    </div>
  )
}
