// The project's files as text, for the design page to read: Vite's version. (Where there is no
// Vite, read the same files on the server instead: the skill's adapting.md.)
//
// Every path here is relative to this file. Vite wants each glob's options written out in place. `app` paths are rewritten to start at the repo root.

import shadcn from '../../../components.json'
import stylesheet from '../styles/global.css?raw'
import preset from './shadcn-preset.gen.json'
import type { Sources } from './types'

// The stylesheet keeps each theme under a class on <html> (.light, .dark, .hard-light, .steam,
// .system), where the page reads shadcn's :root and .dark. It shows the default pair: .light as
// the light theme, .dark as it is. The other three are the user's to pick in Settings.
const css = stylesheet
  .replace(/^\.light \{/m, ':root {')
  .replace(/^\/\*[^\n]*\*\/\n\.(hard-light|steam|system) \{[^}]*\}\n/gm, '')

export const sources: Sources = {
  css,
  cssFile: 'src/renderer/styles/global.css',
  shadcn,
  preset,
  components: Object.entries(
    import.meta.glob<string>('../components/ui/*.tsx', {
      eager: true,
      query: '?raw',
      import: 'default',
    }),
  ).map(([path, code]) => ({ name: path.slice(path.lastIndexOf('/') + 1, -'.tsx'.length), code })),
  // Every source file that can import a component, but not this page, and nothing that can't
  // load in the browser (server-only and generated files).
  app: Object.entries(
    import.meta.glob<string>(
      ['../**/*.{ts,tsx}', '!./**', '!../**/*.server.*', '!../**/*.gen.*', '!../**/*.test.*'],
      {
        eager: true,
        query: '?raw',
        import: 'default',
      },
    ),
  ).map(([path, code]) => ({ path: `src/renderer/${path.slice('../'.length)}`, code })),
}
