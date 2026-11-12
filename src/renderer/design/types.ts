// What the design page is given. `Sources` is the project's files as text (sources.ts reads
// them); `Project` is what only this project can say about itself (project.tsx).

import type { ComponentType, ReactNode } from 'react'

import type { Theme, Tokens } from './tokens'

export type DemoMeta = {
  title: string
  /** The UI component files this demo shows, without `.tsx`: `button`, or `folder/name` for one
      in a subfolder. */
  components: string[]
  /** For the project's own components, which live outside the UI folder: the file, from the
      repo root, and what it exports. A demo with this goes under "Custom components". */
  custom?: { file: string; exports: string }
}

export type DemoModule = { default: ComponentType; meta: DemoMeta }

/** What `shadcn info --json` says (design-preset.ts writes it). Older setups have no preset. */
export type Preset = {
  /** The component library: base (Base UI), radix or aria. */
  base?: string | null
  code?: string | null
  values?: null | Partial<
    Record<
      | 'theme'
      | 'chartColor'
      | 'font'
      | 'fontHeading'
      | 'iconLibrary'
      | 'radius'
      | 'menuColor'
      | 'menuAccent',
      string
    >
  >
  /** Choices the project makes that shadcn/create has no option for (its own theme or fonts).
      For these, `values` holds the preset's stand-in, not what the project uses. */
  fallbacks?: string[] | null
}

/** Plain text and JSON only, so a server can read it and hand it to the page. */
export type Sources = {
  /** The stylesheet that declares the theme (components.json: tailwind.css), and its path from
      the repo root. */
  css: string
  cssFile: string
  /** DESIGN.md, if the project has one. Its front matter gives type roles and scales. */
  designMd?: string
  /** components.json. */
  shadcn: {
    style: string
    iconLibrary?: string
    menuColor?: string
    menuAccent?: string
    tailwind: { baseColor: string }
  }
  preset: Preset
  /** Every file in the UI components folder: its name without `.tsx`, and its source. */
  components: { name: string; code: string }[]
  /** The app's own source files (not the design page), with paths from the repo root. They are
      searched to say where each component is used. */
  app: { path: string; code: string }[]
}

/** An entry the project adds to a section. It is shown in each theme on show. */
export type ExtraEntry = {
  title: string
  /** Details after the title: the file, the classes that use it. */
  meta?: ReactNode[]
  render: (theme: Theme, tokens: Tokens) => ReactNode
}

export type Project = {
  /** The project's name: in the page title, and for its own tokens. */
  name: string
  /** The left of the header: the project's logo, linked home. */
  brand: ReactNode
  /** How app files import a UI component, without the file: `@/components/ui`. */
  uiImport: string
  /** Every demo file. */
  demos: DemoModule[]
  theme?: {
    /** How the site marks dark on <html>. shadcn's `.dark` class unless said. */
    dark?: { class: string } | { attribute: string; value: string }
    /** Where the site keeps the visitor's choice in localStorage, if it does. The page's toggle
        writes "light" or "dark" there, so the choice holds on the rest of the site. */
    storageKey?: string
  }
  /** What each colour is for and the classes that use it, as the Roles table. `token` is any
      colour variable in the stylesheet, without the dashes: shadcn's or the project's own. */
  roles: { name: string; token: string; use: string }[]
  /** The type styles, when DESIGN.md's front matter doesn't give them. Type the classes out in
      full here, so Tailwind sees them. */
  typography?: { name: string; classes: string; dark?: string }[]
  /** The words a type role is shown in, by the role's name, and any classes for them. */
  specimens?: Record<string, { text: string; className?: string }>
  /** Entries of the project's own, by section: "colour" or "shape". */
  extra?: { colour?: ExtraEntry[]; shape?: ExtraEntry[] }
  /** The mark on the index entry that is on screen. A dot in the primary colour unless given. */
  marker?: ComponentType<{ className?: string }>
  /** Classes for the page's own chrome: its running text, and its controls (a corner radius,
      say, where the components' own doesn't suit). */
  classes?: { body?: string; control?: string }
  /** Anything the demos need mounted once on the page, such as a toaster. */
  after?: ComponentType<{ theme: Theme }>
}
