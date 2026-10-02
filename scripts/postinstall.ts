import { spawnSync } from 'node:child_process'

// A frozen install must not rewrite the repository. Refresh Nix dependencies explicitly.
if (!process.env.CI) {
  const result = spawnSync('bun2nix', ['-o', 'distro/nix/bun.nix'], { stdio: 'inherit' })
  if (result.error || result.status !== 0) process.exit(result.status ?? 1)
}
