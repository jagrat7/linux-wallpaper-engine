'use client'

// The design page (dev only): the project's tokens and components.
//
// Its shape: the project's logo and a theme toggle on top; an index down the left that lists
// every entry, marks the one on screen, filters, folds and puts the sections and their entries
// in the order you drag them into; and the sections themselves. An entry is what it is (name,
// source, classes), then how it looks. Anything that differs by theme is shown in light and in
// dark side by side, whichever theme the page itself is in (tokens.ts, themeCss, says how).
//
// Nothing is typed in twice. Tokens come from the stylesheet and DESIGN.md (tokens.ts), and
// components from the demo files in ./demos. Each component's parts and the files that use it
// are read from the source as well.
//
// This file is the same in every project. What differs is in project.tsx and sources.ts.

import {
  Fragment,
  createContext,
  use,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
} from 'react'

import { DATA } from './demo'
import {
  Blocks,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Menu,
  Moon,
  MousePointer2,
  Search,
  Shapes,
  Sun,
} from './icons'
import { project } from './project'
import { readTokens, type Theme } from './tokens'
import type { DemoModule, ExtraEntry, Sources } from './types'
import { Button, Sortable, SortableHandle, SortableItem, cn } from './ui'

const capital = (word: string) => word.charAt(0).toUpperCase() + word.slice(1)
const words = (id: string) => id.split('-').map(capital).join(' ')
const slug = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1)

const BODY = project.classes?.body ?? 'text-muted-foreground'
const CONTROL = project.classes?.control

/** Everything the page shows, worked out from the sources. */
function read(sources: Sources) {
  const tokens = readTokens(sources.css, sources.designMd, project.name)

  // One of each: some bundlers list a file under two paths.
  const demos = [...new Map(project.demos.map((demo) => [demo.meta.title, demo])).values()].sort(
    (a, b) => a.meta.title.localeCompare(b.meta.title),
  )
  const uiDemos = demos.filter((demo) => !demo.meta.custom)
  const customDemos = demos.filter((demo) => demo.meta.custom)

  // Every component in the UI folder: to name the ones no demo shows yet, to list each one's
  // parts (what it exports), and to find the files that import it.
  const components = sources.components.map((c) => c.name).sort()
  const shown = new Set(demos.flatMap((demo) => demo.meta.components))
  const missing = components.filter((name) => !shown.has(name))

  /** The components a file exports, without the name they share: Card / Header / Title. */
  const parts = Object.fromEntries(
    sources.components.map(({ name, code }) => {
      const names = (code.match(/export \{([^}]+)\}/)?.[1] ?? '')
        .split(',')
        .map((n) => n.trim())
        .filter((n) => /^[A-Z]/.test(n))
      const root = names.find((n) => names.every((other) => other.startsWith(n))) ?? ''
      return [name, names.map((n) => (n === root ? n : n.slice(root.length))).join(' / ')]
    }),
  )

  const users = Object.fromEntries(
    components.map((name) => {
      const path = `${project.uiImport}/${name}`
      return [
        name,
        sources.app
          .filter(({ code }) => code.includes(`${path}"`) || code.includes(`${path}'`))
          .map((file) => file.path),
      ]
    }),
  )
  const usedIn = (names: string[]) =>
    [...new Set(names.flatMap((name) => users[name] ?? []))].sort()

  /** The type roles: the project's, else DESIGN.md's. */
  const typography = (theme: Theme) =>
    project.typography
      ? project.typography.map((role) => ({
          name: role.name,
          classes: theme === 'dark' && role.dark ? role.dark : role.classes,
          style: undefined,
        }))
      : tokens.typography(theme)

  const extra = (entries: ExtraEntry[] = []) => entries.map((entry) => entry.title)

  /** The page's contents: its sections and the entries in each. The index is drawn from this,
      and an entry's address is its section's id and its title (`#shadcn-button`). */
  const contents = [
    { id: 'preset', title: 'shadcn preset', entries: ['Preset'] },
    {
      id: 'colour',
      title: 'Colour palette',
      entries: ['Roles', ...extra(project.extra?.colour), 'All tokens'],
    },
    { id: 'type', title: 'Typography', entries: typography('light').map((r) => capital(r.name)) },
    {
      id: 'shape',
      title: 'Shape and space',
      entries: [
        'Radius',
        ...(tokens.scale('spacing').length > 0 ? ['Spacing'] : []),
        ...extra(project.extra?.shape),
      ],
    },
    { id: 'shadcn', title: 'shadcn components', entries: uiDemos.map((d) => d.meta.title) },
    { id: 'custom', title: 'Custom components', entries: customDemos.map((d) => d.meta.title) },
  ].filter((section) => section.entries.length > 0)

  return {
    sources,
    tokens,
    uiDemos,
    customDemos,
    components,
    missing,
    parts,
    usedIn,
    usedCount: components.filter((name) => (users[name] ?? []).length > 0).length,
    tokenCount: tokens.groups.reduce((sum, group) => sum + group.tokens.length, 0),
    typography,
    contents,
  }
}

type Design = ReturnType<typeof read>
type Contents = Design['contents']

const DesignContext = createContext<Design | null>(null)
function useDesign() {
  const design = use(DesignContext)
  if (!design) throw new Error('Not inside the design page')
  return design
}

// What is remembered between visits, per project: localhost is shared.
const key = (name: string) => `${slug(project.name)}-design-${name}`
/** Which sections are folded. */
const CLOSED_KEY = key('closed')
/** The order the sections are in, once they have been moved. */
const ORDER_KEY = key('order')
/** The same for the entries in each section, by the section's id. */
const ENTRY_ORDER_KEY = key('entry-order')
/** Which themes' previews are on show. Never none. */
const PREVIEWS_KEY = key('previews')

const remember = (name: string, value: unknown) => {
  try {
    localStorage.setItem(name, JSON.stringify(value))
  } catch {
    // Private mode or storage blocked: the choice lasts for this visit only.
  }
}

/** `all` in the `stored` order. What `stored` doesn't know of goes where it is in `all`, and what
    it knows of that is gone is dropped: it may be from before something was added or removed. */
const arrange = (all: string[], stored: string[] = []) => {
  const order = stored.filter((name) => all.includes(name))
  all.forEach((name, at) => {
    if (!order.includes(name)) order.splice(Math.min(at, order.length), 0, name)
  })
  return order
}

const Previews = createContext<Theme[]>(['light'])

/** What the filter is set to, in lower case; and the section an entry is in. */
const Filter = createContext('')
const SectionId = createContext('')

const matches = (title: string, filter: string) => title.toLowerCase().includes(filter)

/** The page's column: wide, to fit two panels side by side. */
const WRAP = 'mx-auto w-full max-w-[1680px] px-5 min-[720px]:px-8'

// ---------- The page's theme ----------

const DARK = project.theme?.dark ?? { class: 'dark' }
const isDark = (el: Element) =>
  'class' in DARK
    ? el.classList.contains(DARK.class)
    : el.getAttribute(DARK.attribute) === DARK.value
const setDark = (el: Element, on: boolean) => {
  if ('class' in DARK) el.classList.toggle(DARK.class, on)
  else if (on) el.setAttribute(DARK.attribute, DARK.value)
  else el.removeAttribute(DARK.attribute)
}
/** What makes a panel dark, whatever is around it: the site's own mark for `dark:` classes, and
    `.design-dark` for the variables. */
const DARK_PANEL =
  'class' in DARK
    ? { className: `${DARK.class} design-dark` }
    : { className: 'design-dark', [DARK.attribute]: DARK.value }

/** The page's theme. It lives in `data-design-theme` on <html>, never in the site's own mark:
    that would turn the light panels dark too. So the page takes the site's mark off <html>
    while it is open (and again if the site puts it back), and returns it on leaving.
    `?theme=light|dark` picks one for a visit, which is how a screenshot asks for each. */
function usePageTheme() {
  const [theme, setTheme] = useState<Theme>('light')
  useLayoutEffect(() => {
    const html = document.documentElement
    const apply = (next: Theme) => {
      html.dataset.designTheme = next
      setTheme(next)
    }
    const take = () => {
      if (!isDark(html)) return false
      setDark(html, false)
      return true
    }
    const param = new URLSearchParams(location.search).get('theme')
    const asked = param === 'light' || param === 'dark' ? param : undefined
    const site: Theme = take() ? 'dark' : 'light'
    apply(asked ?? site)
    // A theme provider may put the mark back after this runs. It comes off again, and the page
    // follows it unless the address asked for a theme.
    const observer = new MutationObserver(() => {
      if (take() && !asked) apply('dark')
    })
    observer.observe(html, {
      attributes: true,
      attributeFilter: ['class' in DARK ? 'class' : DARK.attribute],
    })
    return () => {
      observer.disconnect()
      setDark(html, html.dataset.designTheme === 'dark')
      delete html.dataset.designTheme
    }
  }, [])
  const set = (next: Theme) => {
    document.documentElement.dataset.designTheme = next
    setTheme(next)
    try {
      if (project.theme?.storageKey) localStorage.setItem(project.theme.storageKey, next)
    } catch {
      // Private mode or storage blocked: the choice lasts for this page only.
    }
  }
  return { theme, toggle: () => set(theme === 'dark' ? 'light' : 'dark') }
}

export default function DesignPage({ sources }: { sources: Sources }) {
  const design = useMemo(() => read(sources), [sources])
  const { tokens } = design
  const THEMES = tokens.themes
  const ids = design.contents.map((s) => s.id)

  const { theme, toggle } = usePageTheme()
  const other = theme === 'dark' ? 'light' : 'dark'
  const [closed, setClosed] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const filter = query.trim().toLowerCase()

  const [order, setOrder] = useState(ids)
  const [entryOrder, setEntryOrder] = useState<Record<string, string[]>>({})
  const [previews, setPreviews] = useState<Theme[]>(THEMES)

  useEffect(() => {
    try {
      setClosed(JSON.parse(localStorage.getItem(CLOSED_KEY) ?? '[]'))
      setOrder(arrange(ids, JSON.parse(localStorage.getItem(ORDER_KEY) ?? '[]')))
      setEntryOrder(JSON.parse(localStorage.getItem(ENTRY_ORDER_KEY) ?? '{}'))
      const shown: Theme[] = JSON.parse(localStorage.getItem(PREVIEWS_KEY) ?? '[]')
      if (THEMES.some((t) => shown.includes(t)))
        setPreviews(THEMES.filter((t) => shown.includes(t)))
    } catch {
      // Storage blocked or unreadable: everything starts open.
    }
    // Once, on arriving.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fold = (next: string[]) => {
    setClosed(next)
    remember(CLOSED_KEY, next)
  }
  const setOpen = (id: string, open: boolean) =>
    fold(open ? closed.filter((c) => c !== id) : [...closed.filter((c) => c !== id), id])
  // A filter opens everything it finds something in.
  const isOpen = (id: string) => filter !== '' || !closed.includes(id)

  const reorder = (next: string[]) => {
    setOrder(next)
    remember(ORDER_KEY, next)
  }
  const reorderEntries = (id: string, entries: string[]) => {
    const next = { ...entryOrder, [id]: entries }
    setEntryOrder(next)
    remember(ENTRY_ORDER_KEY, next)
  }
  /** Show or hide one theme's previews. Hiding the only one on show swaps to the other. */
  const togglePreview = (which: Theme) => {
    const without = previews.filter((t) => t !== which)
    const next = !previews.includes(which)
      ? THEMES.filter((t) => t === which || previews.includes(t))
      : without.length > 0
        ? without
        : THEMES.filter((t) => t !== which)
    setPreviews(next)
    remember(PREVIEWS_KEY, next)
  }

  /** The page's contents as they are arranged now. */
  const contents = arrange(ids, order).flatMap((id) => {
    const section = design.contents.find((s) => s.id === id)
    return section ? [{ ...section, entries: arrange(section.entries, entryOrder[id]) }] : []
  })

  useEntryOnScreen(`${closed.join()}|${filter}|${contents.map((s) => s.entries.join()).join()}`)

  /** A section. Its entries are keyed by their title, which is what puts them in order. */
  const section = (id: string, summary: ReactNode, entries: ReactElement[]) => {
    const found = contents.find((s) => s.id === id)
    if (!found || !found.entries.some((entry) => matches(entry, filter))) return null
    const children = [...entries].sort(
      (a, b) => found.entries.indexOf(String(a.key)) - found.entries.indexOf(String(b.key)),
    )
    return (
      <Section
        id={id}
        title={found.title}
        summary={summary}
        open={isOpen(id)}
        onToggle={(open) => setOpen(id, open)}
      >
        {children}
      </Section>
    )
  }

  const { preset, shadcn } = sources
  const sections: Record<string, ReactNode> = {
    preset: section(
      'preset',
      preset.code ? `--preset ${preset.code}` : shadcn.style,
      presetEntries(design),
    ),
    colour: section(
      'colour',
      `${project.roles.length} roles · ${design.tokenCount} tokens`,
      colourEntries(design),
    ),
    type: section('type', `${design.typography('light').length} roles`, typeEntries(design)),
    shape: section(
      'shape',
      (contents.find((s) => s.id === 'shape')?.entries ?? []).join(' · ').toLowerCase(),
      shapeEntries(design),
    ),
    shadcn: section(
      'shadcn',
      <>
        {design.components.length} components · {design.usedCount} in use
        {design.missing.length > 0 && <> · no demo yet: {design.missing.join(', ')}</>}
      </>,
      design.uiDemos.map((demo) => <Component key={demo.meta.title} demo={demo} />),
    ),
    custom: section(
      'custom',
      `${design.customDemos.length} components`,
      design.customDemos.map((demo) => <Component key={demo.meta.title} demo={demo} />),
    ),
  }

  return (
    <DesignContext value={design}>
      <Previews value={previews}>
        <Filter value={filter}>
          <div className="bg-background text-foreground min-h-svh font-sans antialiased">
            <style>{tokens.themeCss}</style>
            <header className="bg-background sticky top-0 z-30">
              <h1 className="sr-only">{project.name} design</h1>
              <div className={`${WRAP} flex h-15 items-center justify-between gap-4`}>
                {project.brand}
                {THEMES.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(BODY, CONTROL)}
                    onClick={toggle}
                    aria-label={`Switch to ${other} mode`}
                    title={`Switch to ${other} mode`}
                  >
                    {theme === 'dark' ? <Sun /> : <Moon />}
                  </Button>
                )}
              </div>
            </header>

            <div
              className={`${WRAP} grid gap-x-12 min-[1100px]:grid-cols-[210px_minmax(0,1fr)] min-[1100px]:items-start`}
            >
              <Index
                sections={contents}
                onReorder={reorder}
                onReorderEntries={reorderEntries}
                filter={filter}
                query={query}
                onQuery={setQuery}
                isOpen={isOpen}
                onOpen={setOpen}
                allClosed={ids.every((id) => closed.includes(id))}
                onFoldAll={(all) => fold(all ? ids : [])}
                themes={THEMES}
                previews={previews}
                onTogglePreview={togglePreview}
              />

              <main className="min-w-0 pt-1 pb-24">
                {contents.map(({ id }) => (
                  <Fragment key={id}>{sections[id]}</Fragment>
                ))}
                {filter !== '' &&
                  !contents.some((s) => s.entries.some((e) => matches(e, filter))) && (
                    <p className={`py-10 ${BODY}`}>Nothing is called "{query.trim()}".</p>
                  )}
              </main>
            </div>

            {project.after && <project.after theme={theme} />}
          </div>
        </Filter>
      </Previews>
    </DesignContext>
  )
}

// The entry at the top of the screen, which the index marks. It is kept outside React state, and
// each row of the index asks only "is it me?": so when the mark moves, the row it leaves and the
// row it lands on render again, and nothing else. (As state on the page, every move rendered
// the whole page again, about 60ms each time.)
let entryOnScreen: string | undefined
const entryWatchers = new Set<() => void>()
const watchEntryOnScreen = (watch: () => void) => {
  entryWatchers.add(watch)
  return () => void entryWatchers.delete(watch)
}
const useIsOnScreen = (id: string) =>
  useSyncExternalStore(
    watchEntryOnScreen,
    () => entryOnScreen === id,
    () => false,
  )

/** Keeps `entryOnScreen` up to date. `layout` is anything that changes which entries are on the
    page. */
function useEntryOnScreen(layout: string) {
  useEffect(() => {
    const entries = [...document.querySelectorAll<HTMLElement>('[data-entry]')]
    const update = () => {
      // The last entry whose top has passed under the header; before any has, the first one.
      const visible = entries.filter((el) => el.offsetParent !== null)
      const passed = visible.filter((el) => el.getBoundingClientRect().top <= 160)
      const id = (passed.at(-1) ?? visible[0])?.id
      if (id === entryOnScreen) return
      entryOnScreen = id
      for (const watch of entryWatchers) watch()
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [layout])
}

const INDEX_LINK = '[transition:color_150ms_ease] pointer-fine:hover:text-foreground'

function Dot({ className }: { className?: string }) {
  return (
    <i
      aria-hidden="true"
      className={cn('bg-primary inline-block size-[7px] flex-none rounded-full', className)}
    />
  )
}
const Marker = project.marker ?? Dot

/** An entry's link in the index, with the mark when it is the entry on screen. */
function IndexLink({ id, children }: { id: string; children: ReactNode }) {
  const current = useIsOnScreen(id)
  return (
    <>
      {current && <Marker className="absolute top-1/2 -left-[18px] -translate-y-1/2" />}
      <a
        href={`#${id}`}
        aria-current={current ? 'location' : undefined}
        className={cn(
          'min-w-0 flex-1 py-1',
          INDEX_LINK,
          current ? 'text-foreground font-medium' : BODY,
        )}
      >
        {children}
      </a>
    </>
  )
}

// ---------- The index ----------

/** Down the left: a filter, then every section and its entries. The entry on screen carries the
    mark. A section folds here or at its own heading. */
function Index({
  sections,
  onReorder,
  onReorderEntries,
  filter,
  query,
  onQuery,
  isOpen,
  onOpen,
  allClosed,
  onFoldAll,
  themes,
  previews,
  onTogglePreview,
}: {
  /** The sections in the order they are in now. */
  sections: Contents
  onReorder: (order: string[]) => void
  onReorderEntries: (id: string, entries: string[]) => void
  filter: string
  query: string
  onQuery: (query: string) => void
  isOpen: (id: string) => boolean
  onOpen: (id: string, open: boolean) => void
  allClosed: boolean
  onFoldAll: (all: boolean) => void
  themes: Theme[]
  previews: Theme[]
  onTogglePreview: (theme: Theme) => void
}) {
  return (
    <aside className="py-6 min-[1100px]:sticky min-[1100px]:top-15 min-[1100px]:max-h-[calc(100svh-60px)] min-[1100px]:overflow-y-auto min-[1100px]:py-8 min-[1100px]:[scrollbar-width:none]">
      <div className="flex items-center gap-1.5">
        <label className="relative min-w-0 flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <input
            type="search"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Filter"
            aria-label="Filter the page"
            className={cn(
              'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full rounded-md border bg-transparent pr-2.5 pl-8 text-[13px] outline-none focus-visible:ring-1',
              CONTROL,
            )}
          />
        </label>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn('size-8 flex-none', CONTROL)}
          disabled={filter !== ''}
          onClick={() => onFoldAll(!allClosed)}
          aria-label={allClosed ? 'Unfold all sections' : 'Fold all sections'}
          title={allClosed ? 'Unfold all sections' : 'Fold all sections'}
        >
          {allClosed ? <ChevronsUpDown /> : <ChevronsDownUp />}
        </Button>
      </div>

      {/* Which themes the previews come in: both, or one. */}
      {themes.length > 1 && (
        <div role="group" aria-label="Previews" className="mt-2 grid grid-cols-2 gap-1.5">
          {themes.map((theme) => {
            const on = previews.includes(theme)
            const Icon = theme === 'dark' ? Moon : Sun
            return (
              <Button
                key={theme}
                type="button"
                variant={on ? 'secondary' : 'ghost'}
                size="sm"
                aria-pressed={on}
                title={`${on ? 'Hide' : 'Show'} the ${theme} previews`}
                onClick={() => onTogglePreview(theme)}
                className={cn('capitalize', CONTROL, !on && 'text-muted-foreground')}
              >
                <Icon data-icon="inline-start" />
                {theme}
              </Button>
            )
          })}
        </div>
      )}

      <nav aria-label="On this page" className="mt-6 text-[13px]">
        {/* Sections drag into a new order by their grip. Not while filtering: some are hidden. */}
        <Sortable value={sections.map((s) => s.id)} onValueChange={onReorder} className="gap-5">
          {sections.map((section) => {
            const entries = section.entries.filter((entry) => matches(entry, filter))
            if (entries.length === 0) return null
            const open = isOpen(section.id)
            return (
              <SortableItem key={section.id} value={section.id} className="bg-background">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onOpen(section.id, !open)}
                    aria-expanded={open}
                    aria-label={`${open ? 'Fold' : 'Unfold'} ${section.title}`}
                    className="text-muted-foreground pointer-fine:hover:text-foreground -ml-1 grid size-5 cursor-pointer place-items-center"
                  >
                    <ChevronRight
                      className={cn('size-3.5 transition-transform', open && 'rotate-90')}
                    />
                  </button>
                  <a href={`#${section.id}`} className={`font-bold ${INDEX_LINK}`}>
                    {section.title}
                  </a>
                  {filter === '' && (
                    <SortableHandle
                      className="text-muted-foreground/60 ml-auto size-5 rounded-[4px]"
                      aria-label={`Move ${section.title}`}
                      title="Drag to move"
                    />
                  )}
                </div>
                {open && (
                  // The entries drag too, within their section; the page follows.
                  <Sortable
                    role="list"
                    value={entries}
                    onValueChange={(next) => onReorderEntries(section.id, next)}
                    className="mt-1.5 ml-[6px] gap-px border-l pl-3.5"
                  >
                    {entries.map((entry) => (
                      <SortableItem
                        key={entry}
                        value={entry}
                        role="listitem"
                        className="group/entry bg-background flex items-center"
                      >
                        <IndexLink id={`${section.id}-${slug(entry)}`}>{entry}</IndexLink>
                        {filter === '' && (
                          // Shown on hover or focus, so the list stays calm; always, where nothing can hover.
                          <SortableHandle
                            className="text-muted-foreground/60 size-5 rounded-[4px] opacity-0 group-hover/entry:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                            aria-label={`Move ${entry}`}
                            title="Drag to move"
                          />
                        )}
                      </SortableItem>
                    ))}
                  </Sortable>
                )}
              </SortableItem>
            )
          })}
        </Sortable>
      </nav>
    </aside>
  )
}

// ---------- The sections ----------

const LIBRARIES: Record<string, string> = {
  base: 'Base UI',
  radix: 'Radix UI',
  aria: 'React Aria',
}

/** The shadcn setup, as the choices shadcn/create offers and in its order. The preset code and
    what only the CLI can work out come from shadcn-preset.gen.json (design-preset.ts); the rest
    is read from components.json and the stylesheet as they are now. A choice the setup doesn't
    say is left out. */
function choices({ sources: { shadcn, preset }, tokens }: Design) {
  const values = preset.values ?? {}
  /** A choice shadcn/create has no option for, so the preset code holds a stand-in for it. */
  const own = (name: string) => preset.fallbacks?.includes(name)
  const named = (name: string | undefined) => (name ? words(name) : undefined)
  const sans = tokens.fontFace('font-sans')
  const list: { label: string; value?: string; own?: boolean; glyph: ReactNode }[] = [
    {
      label: 'Component library',
      value: preset.base && (LIBRARIES[preset.base] ?? preset.base),
      glyph: <Blocks />,
    },
    {
      label: 'Style',
      value: words(preset.base ? shadcn.style.replace(`${preset.base}-`, '') : shadcn.style),
      glyph: <span className="size-4 border-2 border-current" />,
    },
    {
      label: 'Base colour',
      value: words(shadcn.tailwind.baseColor),
      glyph: <span className="bg-muted-foreground size-4 rounded-full" />,
    },
    {
      label: 'Theme',
      value: own('theme') ? project.name : named(values.theme),
      own: own('theme'),
      glyph: <Marker className="size-4" />,
    },
    {
      label: 'Chart colour',
      value: named(values.chartColor),
      glyph: <span className="bg-chart-2 size-4 rounded-full" />,
    },
    {
      label: 'Heading',
      value: own('fontHeading')
        ? tokens.fontFace('font-heading') || sans
        : named(values.fontHeading),
      own: own('fontHeading'),
      glyph: <span className="font-sans text-[15px] font-bold">Aa</span>,
    },
    {
      label: 'Font',
      value: own('font') ? sans : named(values.font),
      own: own('font'),
      glyph: <span className="font-sans text-[15px]">Aa</span>,
    },
    {
      label: 'Icon library',
      value: named(shadcn.iconLibrary ?? values.iconLibrary),
      glyph: <Shapes />,
    },
    {
      label: 'Radius',
      value: own('radius') ? tokens.radius : named(values.radius),
      own: own('radius'),
      glyph: (
        <span
          className="size-4 border-t-2 border-r-2 border-current"
          style={{ borderTopRightRadius: tokens.radius }}
        />
      ),
    },
    { label: 'Menu', value: named(shadcn.menuColor ?? values.menuColor), glyph: <Menu /> },
    {
      label: 'Menu accent',
      value: named(shadcn.menuAccent ?? values.menuAccent),
      glyph: <MousePointer2 />,
    },
  ]
  return list.filter((choice) => choice.value)
}

function presetEntries(design: Design) {
  return [
    <Entry
      key="Preset"
      title="Preset"
      meta={['components.json', baseName(design.sources.cssFile), 'shadcn info']}
    >
      <dl className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2">
        {choices(design).map((choice) => (
          <div
            key={choice.label}
            className="flex items-start gap-3 rounded-lg border px-3.5 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <dt className="text-muted-foreground text-[12px]">{choice.label}</dt>
              <dd className="truncate text-[15px] font-semibold">{choice.value}</dd>
              {choice.own && <dd className={`${DATA} text-muted-foreground`}>not in the preset</dd>}
            </div>
            <span className={`mt-2 grid size-5 flex-none place-items-center ${BODY}`}>
              {choice.glyph}
            </span>
          </div>
        ))}
      </dl>
    </Entry>,
  ]
}

/** The project's own entries for a section. */
function extraEntries(entries: ExtraEntry[] = [], { tokens }: Design) {
  return entries.map((entry) => (
    <Entry key={entry.title} title={entry.title} meta={entry.meta ?? []}>
      <Themed>{(theme) => entry.render(theme, tokens)}</Themed>
    </Entry>
  ))
}

function colourEntries(design: Design) {
  const { tokens, tokenCount, sources } = design
  const file = baseName(sources.cssFile)
  return [
    <Entry key="Roles" title="Roles" meta={[file, 'What each colour is for']}>
      <TokenTable
        detail="Use"
        rows={project.roles.map((role) => ({
          name: role.name,
          detail: role.use,
          token: role.token,
        }))}
      />
    </Entry>,

    ...extraEntries(project.extra?.colour, design),

    <Entry key="All tokens" title="All tokens" meta={[file, `${tokenCount} tokens`]}>
      <details className="group/all">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[13px] font-medium [&::-webkit-details-marker]:hidden">
          <ChevronRight className="text-muted-foreground size-4 transition-transform group-open/all:rotate-90" />
          <span className="group-open/all:hidden">Show all {tokenCount}</span>
          <span className="hidden group-open/all:inline">Hide</span>
        </summary>
        <div className="mt-5 grid gap-8">
          {tokens.groups.map((group) => (
            <div key={group.name} className="grid gap-2">
              <h4 className="text-[13px] font-bold">{group.name}</h4>
              <TokenTable
                rows={group.tokens.map((token) => ({ name: token.replace('color-', ''), token }))}
              />
            </div>
          ))}
        </div>
      </details>
    </Entry>,
  ]
}

function typeEntries({ typography }: Design) {
  const night = typography('dark')
  return typography('light').map((role, i) => {
    const dark = night[i] ?? role
    const specimen = project.specimens?.[role.name]
    return (
      <Entry
        key={capital(role.name)}
        title={capital(role.name)}
        meta={[role.classes, dark.classes !== role.classes && `dark: ${dark.classes}`]}
      >
        <Themed>
          {(theme) => {
            const shown = theme === 'dark' ? dark : role
            return (
              <p
                className={cn('font-sans text-pretty', shown.classes, specimen?.className)}
                style={shown.style}
              >
                {specimen?.text ?? 'The quick brown fox jumps over the lazy dog'}
              </p>
            )
          }}
        </Themed>
      </Entry>
    )
  })
}

function shapeEntries(design: Design) {
  const { tokens, sources } = design
  const rounded = tokens.scale('rounded')
  const spacing = tokens.scale('spacing')
  return [
    // DESIGN.md's corners if it lists them, else the steps the stylesheet names.
    <Entry
      key="Radius"
      title="Radius"
      meta={[
        rounded.length > 0 ? 'DESIGN.md' : baseName(sources.cssFile),
        `--radius: ${tokens.radius}`,
      ]}
    >
      <div className="flex flex-wrap items-end gap-x-8 gap-y-6">
        {rounded.length > 0
          ? rounded.map((step) => (
              <Tile
                key={step.name}
                name={`${step.name} · ${step.px}px`}
                detail={tokens.radiusClass(step.px)}
              >
                <div className="bg-card size-14 border" style={{ borderRadius: step.px }} />
              </Tile>
            ))
          : tokens.radiusSteps.map((step) => (
              <Tile
                key={step}
                name={step.replace('radius-', '')}
                detail={step.replace('radius', 'rounded')}
              >
                <div
                  className="bg-card size-14 border"
                  style={{ borderRadius: `var(--${step})` }}
                />
              </Tile>
            ))}
      </div>
    </Entry>,

    ...(spacing.length > 0
      ? [
          <Entry key="Spacing" title="Spacing" meta={['DESIGN.md', 'spacing']}>
            <div className="flex flex-wrap items-end gap-x-8 gap-y-6">
              {spacing.map((step) => (
                <Tile
                  key={step.name}
                  name={`${step.name} · ${step.px}px`}
                  detail={`p-${step.px / 4} · gap-${step.px / 4}`}
                >
                  <div className="bg-primary" style={{ width: step.px, height: step.px }} />
                </Tile>
              ))}
            </div>
          </Entry>,
        ]
      : []),

    ...extraEntries(project.extra?.shape, design),
  ]
}

/** One demo: where it comes from and what it is made of, then the demo itself. */
function Component({ demo: { default: Demo, meta } }: { demo: DemoModule }) {
  const { usedIn, parts } = useDesign()
  const files = usedIn(meta.components)
  return (
    <Entry
      title={meta.title}
      meta={
        meta.custom
          ? [meta.custom.file, meta.custom.exports]
          : [
              meta.components.map((name) => `${name}.tsx`).join(' · '),
              meta.components.length === 1 && parts[meta.components[0] ?? ''],
              files.length === 0 ? (
                'Not used yet'
              ) : (
                <details key="used" className="open:basis-full">
                  <summary className="text-foreground cursor-pointer">
                    Used in {files.length} {files.length === 1 ? 'file' : 'files'}
                  </summary>
                  <ul className="mt-1 grid gap-0.5">
                    {files.map((file) => (
                      <li key={file}>{file}</li>
                    ))}
                  </ul>
                </details>
              ),
            ]
      }
    >
      <Themed>{() => <Demo />}</Themed>
    </Entry>
  )
}

// ---------- The page's own parts ----------

function Section({
  id,
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  id: string
  title: string
  summary: ReactNode
  open: boolean
  onToggle: (open: boolean) => void
  children: ReactNode
}) {
  return (
    <details
      id={id}
      open={open}
      onToggle={(event) => {
        if (event.currentTarget.open !== open) onToggle(event.currentTarget.open)
      }}
      className="group/section scroll-mt-15 border-t first:border-t-0"
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-4 gap-y-1 py-7 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="text-muted-foreground size-5 self-center transition-transform group-open/section:rotate-90" />
        <h2 className="text-[28px] leading-[1.05] font-bold tracking-[-0.02em]">{title}</h2>
        <span className={`${DATA} text-muted-foreground`}>{summary}</span>
      </summary>
      <div className="pb-8">
        <SectionId value={id}>{children}</SectionId>
      </div>
    </details>
  )
}

/** One thing in a section: its name and details on a line, then how it looks. */
function Entry({
  title,
  meta,
  children,
}: {
  title: string
  /** Details after the title; falsy ones are skipped. */
  meta: ReactNode[]
  children: ReactNode
}) {
  const section = use(SectionId)
  if (!matches(title, use(Filter))) return null
  return (
    <article
      id={`${section}-${slug(title)}`}
      data-entry
      className="grid scroll-mt-20 grid-cols-[minmax(0,1fr)] gap-4 border-t py-6 first:border-t-0 first:pt-0"
    >
      <header className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
        <h3 className="text-[16px] leading-[1.25] font-bold">{title}</h3>
        {meta.filter(Boolean).map((line, i) => (
          <div
            key={i}
            className={`${DATA} text-muted-foreground contents [overflow-wrap:anywhere]`}
          >
            {typeof line === 'string' ? <span>{line}</span> : line}
          </div>
        ))}
      </header>
      {children}
    </article>
  )
}

/** The same thing in light and in dark, side by side; or in the one theme the index leaves on.
    A panel sets its theme's variables itself, whatever the page around it is in. */
function Themed({ children }: { children: (theme: Theme) => ReactNode }) {
  const previews = use(Previews)
  return (
    <div className={cn('grid gap-4', previews.length === 2 && 'min-[1280px]:grid-cols-2')}>
      {previews.map((theme) => {
        const { className, ...mark } = theme === 'dark' ? DARK_PANEL : { className: 'design-light' }
        return (
          <div
            key={theme}
            data-panel={theme}
            {...mark}
            className={cn(
              className,
              'bg-background text-foreground min-w-0 overflow-hidden rounded-lg border p-5',
            )}
          >
            {children(theme)}
          </div>
        )
      })}
    </div>
  )
}

/** Colour tokens, one per row, with their value in each theme. Each value sits on its own
    theme's background, whichever theme the page is in. */
function TokenTable({
  detail,
  rows,
}: {
  /** The heading of the middle column, if the rows have a `detail`. */
  detail?: string
  rows: { name: string; detail?: string; token: string }[]
}) {
  const { tokens } = useDesign()
  const heading = `${DATA} pb-1 text-left font-normal text-muted-foreground`
  return (
    <table className="w-full max-w-[1000px] border-separate border-spacing-x-0 border-spacing-y-1.5">
      <thead>
        <tr>
          <th className={`${heading} w-[150px]`}>Name</th>
          {detail && <th className={heading}>{detail}</th>}
          {tokens.themes.map((theme) => (
            <th key={theme} className={`${heading} w-[220px] capitalize`}>
              {tokens.themes.length > 1 ? theme : 'Value'}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.name}>
            <td className="pr-4 text-[13px] font-medium">{row.name}</td>
            {detail && <td className={`${DATA} text-muted-foreground pr-4`}>{row.detail}</td>}
            {tokens.themes.map((theme) => (
              <td key={theme} className="pr-2 last:pr-0">
                <span
                  className="flex items-center gap-2.5 rounded-md border px-2 py-1.5"
                  style={{
                    background: tokens.colour(theme, 'background'),
                    color: tokens.colour(theme, 'foreground'),
                    borderColor: tokens.colour(theme, 'border'),
                  }}
                >
                  <span
                    className="size-5 flex-none rounded-[4px] border"
                    style={{
                      background: tokens.colour(theme, row.token),
                      borderColor: tokens.colour(theme, 'border'),
                    }}
                  />
                  <code className={`${DATA} truncate`} title={tokens.value(theme, row.token)}>
                    {tokens.value(theme, row.token)}
                  </code>
                </span>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Tile({ name, detail, children }: { name: string; detail: string; children: ReactNode }) {
  return (
    <div className="grid content-end gap-2">
      {children}
      <div className={DATA}>
        {name}
        <span className="text-muted-foreground block">{detail}</span>
      </div>
    </div>
  )
}
