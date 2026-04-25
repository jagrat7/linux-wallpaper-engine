// Helpers for shipping native (`.node` + `.so`/`.dll`/`.dylib`) npm packages
// in an Electron Forge build. Native binaries can't be bundled by Vite — they
// must live on disk so dlopen can resolve siblings via RUNPATH=$ORIGIN.

export type NativeDep = {
  // npm package name, e.g. 'steamworks.js'
  pkg: string
  // path of the platform-specific native dir inside the package,
  // e.g. 'dist/linux64'. Whole dir is included and unpacked from asar.
  nativeDir: string
  // JS shims inside the package that must be reachable from the bundled
  // main process (e.g. the package entry that requires the .node binding).
  entryFiles?: string[]
}

const NODE_MODULES = '/node_modules'

const ancestorDirs = (path: string): string[] => {
  const segments = path.split('/').filter(Boolean)
  return segments.map((_, i) => '/' + segments.slice(0, i + 1).join('/'))
}

const stripLeadingSlash = (path: string): string => path.replace(/^\//, '')

export type PackagerHooks = {
  // Drop into `packagerConfig.asar.unpackDir`.
  asarUnpackDir: string
  // Drop into `packagerConfig.ignore`. Returns true for paths to exclude.
  ignore: (filePath: string) => boolean
}

// Builds the `ignore` filter and asar `unpackDir` for an Electron Forge
// build that ships one or more native dependencies. Anything outside the
// native dirs, their entry files, and `includedDirs` is ignored.
export const packageNativeDeps = ({
  deps,
  includedDirs = [],
}: {
  deps: NativeDep[]
  // Extra top-level dirs to include (e.g. '/.vite' for the bundled output).
  includedDirs?: string[]
}): PackagerHooks => {
  const nativeDirs = deps.map(d => `${NODE_MODULES}/${d.pkg}/${d.nativeDir}`)
  const entryFiles = deps.flatMap(d =>
    (d.entryFiles ?? []).map(file => `${NODE_MODULES}/${d.pkg}/${file}`),
  )

  const includedRoots = [...includedDirs, ...nativeDirs]
  const includedPaths = new Set<string>([
    ...includedRoots.flatMap(ancestorDirs),
    ...entryFiles,
  ])

  const ignore = (filePath: string): boolean => {
    if (!filePath) return false
    if (includedPaths.has(filePath)) return false
    return !includedRoots.some(root => filePath.startsWith(`${root}/`))
  }

  // electron-packager passes `unpackDir` to asar as a single glob.
  // Brace-expand when shipping more than one native dep.
  const stripped = nativeDirs.map(stripLeadingSlash)
  const asarUnpackDir = stripped.length === 1 ? stripped[0] : `{${stripped.join(',')}}`

  return { asarUnpackDir, ignore }
}
