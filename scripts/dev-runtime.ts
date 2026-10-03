import fs from 'node:fs/promises'
import path from 'node:path'
import { DEV_RETAINED_RUNS } from '../src/shared/constants/development.ts'

// Runs are named <start time>-<owner pid>: creating the directory records its owner.
const RUN_NAME = /^(\d+)-(\d+)$/

export async function createRunDirectory(runsDirectory: string) {
  const runDirectory = path.join(runsDirectory, `${Date.now()}-${process.pid}`)
  await fs.mkdir(runDirectory, { recursive: true })
  return runDirectory
}

export const runCacheDirectory = (runDirectory: string) => path.join(runDirectory, 'vite-cache')

function isAlive(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    // EPERM means the process exists but belongs to another user.
    return error instanceof Error && 'code' in error && error.code === 'EPERM'
  }
}

// Only owner-named runs whose owner has exited are touched: they lose their Vite cache,
// and only the newest `retain` keep their backend bundle and data for inspection. Other
// entries, including UUID runs from earlier runners, have no recorded owner and stay.
export async function pruneRuns(
  runsDirectory: string,
  currentRun: string,
  retain = DEV_RETAINED_RUNS,
) {
  const finished: { directory: string; started: number }[] = []
  for (const name of await fs.readdir(runsDirectory)) {
    const directory = path.join(runsDirectory, name)
    const owner = RUN_NAME.exec(name)
    if (directory === currentRun || !owner || isAlive(Number(owner[2]))) continue
    finished.push({ directory, started: Number(owner[1]) })
  }
  finished.sort((a, b) => b.started - a.started)
  await Promise.all(
    finished.map(({ directory }, index) =>
      fs.rm(index < retain ? runCacheDirectory(directory) : directory, {
        recursive: true,
        force: true,
      }),
    ),
  )
}
