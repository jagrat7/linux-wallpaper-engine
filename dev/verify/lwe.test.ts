import { afterEach, describe, expect, it } from 'vite-plus/test'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtemp, mkdir, readFile, writeFile, rm, access } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { setTimeout as delay } from 'node:timers/promises'

const repo = path.resolve(import.meta.dirname, '../..')
const harness = process.env.LWE_TEST_HARNESS ?? path.join(repo, 'dev/verify/lwe')
const fixtures: { root: string; children: ChildProcess[] }[] = []

const waitForExit = (child: ChildProcess) =>
  new Promise<number | null>((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', resolve)
  })

async function fixture(mode = 'normal', devLog = '') {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lwe-cleanup-test-'))
  const children: ChildProcess[] = []
  fixtures.push({ root, children })
  for (const dir of ['config', 'chrome', 'logs', 'artifacts']) {
    await mkdir(path.join(root, dir))
  }
  await writeFile(path.join(root, 'backends.before'), '')
  await writeFile(path.join(root, 'logs/dev.log'), devLog)
  const script = path.join(root, 'parent.cjs')
  await writeFile(
    script,
    `const fs = require('node:fs')
const { spawn } = require('node:child_process')
const root = process.env.FIXTURE_ROOT
const trace = text => fs.appendFileSync(root + '/trace', text + '\\n')
const helper = spawn(process.execPath, ['-e', \`
  const fs = require('node:fs')
  process.on('SIGTERM', () => {
    fs.appendFileSync(process.env.FIXTURE_ROOT + '/trace', 'helper-term\\\\n')
    process.exit(0)
  })
  process.send('ready')
  setInterval(() => {}, 1000)
\`], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] })
helper.on('message', () => fs.writeFileSync(root + '/ready', String(helper.pid)))
process.on('SIGTERM', () => {
  trace('parent-term')
  if (process.env.FIXTURE_MODE === 'ignore') return
  setTimeout(() => {
    try { process.kill(helper.pid, 0); trace('helper-still-alive') }
    catch { trace('helper-already-dead'); process.exit(1) }
    helper.once('exit', () => { trace('parent-exit'); process.exit(0) })
    helper.kill('SIGTERM')
  }, 100)
})
setInterval(() => {}, 1000)
`,
  )
  const parent = spawn(process.execPath, [script], {
    argv0: path.join(repo, 'node_modules/electron/dist/electron'),
    detached: true,
    env: { ...process.env, FIXTURE_ROOT: root, FIXTURE_MODE: mode },
    stdio: 'ignore',
  })
  children.push(parent)
  // A separate process group represents an unrelated app that cleanup must leave alone.
  const unrelated = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
    detached: true,
    stdio: 'ignore',
  })
  children.push(unrelated)
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      await access(path.join(root, 'ready'))
      break
    } catch {
      await delay(20)
    }
  }
  await access(path.join(root, 'ready'))
  await writeFile(
    path.join(root, 'state.env'),
    `RUN_ID=test
TARGET=desktop
APP_URL=http://localhost:1
CDP_PORT=0
DEV_PGID=${parent.pid}
BROWSER_PGID=
STORE_DIR='${root}/config'
STEAM_CONFIG=
GIT_REV=test
`,
  )
  const cleanup = async () => {
    const child = spawn('bash', [harness, 'cleanup'], {
      env: { ...process.env, LWE_RUN: root, LWE_VERIFY_ROOT: root },
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    children.push(child)
    let output = ''
    child.stdout.on('data', (data: Buffer) => (output += data.toString()))
    child.stderr.on('data', (data: Buffer) => (output += data.toString()))
    const status = await waitForExit(child)
    return { status, output }
  }
  return { root, parent, unrelated, cleanup }
}

afterEach(async () => {
  for (const { root, children } of fixtures.splice(0)) {
    for (const child of children) {
      try {
        if (child.pid) process.kill(-child.pid, 'SIGKILL')
      } catch {
        // The harness already stopped this process group.
      }
    }
    await rm(root, { recursive: true, force: true })
  }
})

describe('verification cleanup', () => {
  it('lets the Electron parent stop helpers first and preserves unrelated processes and evidence', async () => {
    const { root, unrelated, cleanup } = await fixture()
    const { status, output } = await cleanup()
    expect(status).toBe(0)
    expect(await readFile(path.join(root, 'trace'), 'utf8')).toBe(
      'parent-term\nhelper-still-alive\nhelper-term\nparent-exit\n',
    )
    expect(output).toContain('shutdown verified')
    expect(() => process.kill(unrelated.pid!, 0)).not.toThrow()
    await expect(access(path.join(root, 'config'))).rejects.toThrow()
    await expect(access(path.join(root, 'chrome'))).rejects.toThrow()
    await access(path.join(root, 'artifacts'))
    await access(path.join(root, 'logs/cleanup.log'))
    await access(path.join(root, 'state.env.done'))
  }, 15000)

  it('returns a failure when the parent needs forced termination', async () => {
    const { cleanup, unrelated } = await fixture('ignore')
    const { status, output } = await cleanup()
    expect(status).toBe(1)
    expect(output).toContain('did not stop after 5 s; forcing shutdown')
    expect(output).not.toContain('shutdown verified')
    expect(() => process.kill(unrelated.pid!, 0)).not.toThrow()
  }, 15000)

  it('stops the separate headless browser parent before its helpers', async () => {
    const electron = await fixture()
    const browser = await fixture()
    const stateFile = path.join(electron.root, 'state.env')
    await writeFile(
      stateFile,
      (await readFile(stateFile, 'utf8')).replace(
        'BROWSER_PGID=',
        `BROWSER_PGID=${browser.parent.pid}`,
      ),
    )
    const { status, output } = await electron.cleanup()
    expect(status).toBe(0)
    expect(output).toContain(`stopping Chromium parent ${browser.parent.pid}`)
    expect(await readFile(path.join(browser.root, 'trace'), 'utf8')).toBe(
      'parent-term\nhelper-still-alive\nhelper-term\nparent-exit\n',
    )
    expect(() => process.kill(browser.unrelated.pid!, 0)).not.toThrow()
  })

  it('still cleans up after the app has already exited', async () => {
    const { parent, cleanup, unrelated } = await fixture()
    const exited = waitForExit(parent)
    parent.kill('SIGTERM')
    await exited
    const { status, output } = await cleanup()
    expect(status).toBe(0)
    expect(output).not.toContain('stopping Electron parent')
    expect(output).toContain('shutdown verified')
    expect(() => process.kill(unrelated.pid!, 0)).not.toThrow()
  })

  it('reports fatal run errors even when the optional browser log is absent', async () => {
    const { cleanup, root } = await fixture('normal', '[123:FATAL:gpu] GPU process is not usable\n')
    const { status, output } = await cleanup()
    expect(status).toBe(1)
    expect(output).toContain('FAIL fatal errors were recorded')
    expect(await readFile(path.join(root, 'logs/cleanup.log'), 'utf8')).toContain('FATAL:gpu')
  })
})
