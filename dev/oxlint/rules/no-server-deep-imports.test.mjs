import path from 'node:path'
import { RuleTester } from 'oxlint/plugins-dev'
import { describe, it } from 'vitest'
import noServerDeepImports from './no-server-deep-imports.mjs'

RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: 'ts' } } })
const filename = (file) => path.join(process.cwd(), file)
const options = [
  {
    serverDirectory: 'src/main/services',
  },
]

tester.run('no-server-deep-imports', noServerDeepImports, {
  valid: [
    {
      filename: filename('src/main/trpc/routes/wallpaper.ts'),
      options,
      code: "import { wallpaperService } from '../../services/wallpaper/wallpaper'",
    },
    {
      filename: filename('src/main/services/wallpaper/wallpaper.ts'),
      options,
      code: "import { parseWindowGeometry } from './wallpaper.types'",
    },
    {
      filename: filename('src/main/services/wallpaper/wallpaper.ts'),
      options,
      code: "import { parseWindowGeometry } from './wallpaper.utils'",
    },
    {
      filename: filename('src/renderer/routes/workshop.tsx'),
      options,
      code: "import { WorkshopToolbar } from '@/components/workshop/workshop-toolbar'",
    },
    {
      filename: filename('src/main/trpc/routes/wallpaper.test.ts'),
      options,
      code: "vi.mock('../../services/wallpaper/wallpaper')",
    },
    {
      filename: filename('src/main/trpc/routes/workshop.ts'),
      options,
      code: "import { settingsService } from '../../services/settings'",
    },
    {
      filename: filename('src/main/trpc/routes/playlist.ts'),
      options,
      code: "import { playlistService } from '../../services/playlists/playlist'",
    },
  ],
  invalid: [
    {
      filename: filename('src/main/trpc/routes/wallpaper.ts'),
      options,
      code: "import { parseWindowGeometry } from '../../services/wallpaper/wallpaper.utils'",
      errors: [{ messageId: 'deepImport' }],
    },
    {
      filename: filename('src/main/services/compatibility.ts'),
      options,
      code: "export { parseWindowGeometry } from './wallpaper/wallpaper.types'",
      errors: [{ messageId: 'deepImport' }],
    },
    {
      filename: filename('src/main/services/playlists/playlist-runner.ts'),
      options,
      code: "import { resolveSteamLibraryPaths } from '../wallpaper/wallpaper.utils'",
      errors: [{ messageId: 'deepImport' }],
    },
    {
      filename: filename('src/main/trpc/routes/workshop.ts'),
      options,
      code: "import { isWorkshopConnectionError } from '../../services/workshop/workshop.errors'",
      errors: [{ messageId: 'deepImport' }],
    },
    {
      filename: filename('src/main/main.ts'),
      options,
      code: "import { electronTheme } from './services/system-theme/system-theme.utils'",
      errors: [{ messageId: 'deepImport' }],
    },
    {
      filename: filename('src/main/trpc/routes/wallpaper.ts'),
      options,
      code: "export type { DebugInfo } from '../../services/wallpaper/wallpaper.types'",
      errors: [{ messageId: 'deepImport' }],
    },
    {
      filename: filename('src/main/trpc/routes/wallpaper.ts'),
      options,
      code: "const service = import('../../services/wallpaper/wallpaper.types')",
      errors: [{ messageId: 'deepImport' }],
    },
    {
      filename: filename('src/main/trpc/routes/wallpaper.ts'),
      options,
      code: "type Service = import('../../services/wallpaper/wallpaper.types').DebugInfo",
      errors: [{ messageId: 'deepImport' }],
    },
    {
      filename: filename('src/main/trpc/routes/wallpaper.test.ts'),
      options,
      code: "vi.mock('../../services/wallpaper/wallpaper.types')",
      errors: [{ messageId: 'deepImport' }],
    },
    {
      filename: filename('src/main/trpc/routes/wallpaper.test.ts'),
      options,
      code: "require('../../services/wallpaper/wallpaper.types')",
      errors: [{ messageId: 'deepImport' }],
    },
  ],
})
