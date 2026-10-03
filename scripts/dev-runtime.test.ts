import { spawn, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vite-plus/test'
import { stopOwnedProcess } from './dev-process'
import { createRunDirectory, pruneRuns, runCacheDirectory } from './dev-runtime'

const children: ChildProcess[] = []
const directories: string[] = []
afterEach(async () => {
  await Promise.all(children.splice(0).map((child) => stopOwnedProcess(child)))
  await Promise.all(
    directories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })),
  )
})

async function runsDirectory() {
  const directory = await fs.mkdtemp(path.join(tmpdir(), 'lwe-runs-'))
  directories.push(directory)
  return directory
}

async function ownerPid(exit: boolean) {
  const child = spawn(process.execPath, ['-e', exit ? '' : 'setInterval(() => {}, 1000)'], {
    stdio: 'ignore',
  })
  children.push(child)
  await new Promise<void>((resolve) => child.once(exit ? 'exit' : 'spawn', () => resolve()))
  if (!child.pid) throw new Error('Owner process did not start')
  return child.pid
}

async function run(runs: string, name: string) {
  const directory = path.join(runs, name)
  await Promise.all(
    [path.join(runCacheDirectory(directory), 'deps'), path.join(directory, 'backend')].map(
      (entry) => fs.mkdir(entry, { recursive: true }),
    ),
  )
  await fs.mkdir(path.join(directory, 'data'))
  return directory
}

const exists = (target: string) =>
  fs.access(target).then(
    () => true,
    () => false,
  )

it('keeps live runs intact and retains only recent finished evidence without Vite caches', async () => {
  const runs = await runsDirectory()
  const current = await createRunDirectory(runs)
  await fs.mkdir(runCacheDirectory(current))
  const live = await run(runs, `1000-${await ownerPid(false)}`)
  const finishedOwner = await ownerPid(true)
  const [oldest, older, newest] = await Promise.all(
    [1, 2, 3].map((started) => run(runs, `${started}-${finishedOwner}`)),
  )

  await pruneRuns(runs, current, 2)

  expect(await exists(runCacheDirectory(current))).toBe(true)
  expect(await exists(runCacheDirectory(live))).toBe(true)
  for (const retained of [newest, older]) {
    expect(await exists(runCacheDirectory(retained))).toBe(false)
    expect(await exists(path.join(retained, 'backend'))).toBe(true)
    expect(await exists(path.join(retained, 'data'))).toBe(true)
  }
  expect(await exists(oldest)).toBe(false)
})

it('leaves runs without a recorded owner and unknown entries untouched', async () => {
  const runs = await runsDirectory()
  const current = await createRunDirectory(runs)
  const earlierRunner = await run(runs, randomUUID())
  const unknown = path.join(runs, 'notes.txt')
  await fs.writeFile(unknown, 'kept')

  await pruneRuns(runs, current, 0)

  expect(await exists(runCacheDirectory(earlierRunner))).toBe(true)
  expect(await exists(path.join(earlierRunner, 'data'))).toBe(true)
  expect(await fs.readFile(unknown, 'utf-8')).toBe('kept')
})
