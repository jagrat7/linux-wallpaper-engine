import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
import { stopOwnedProcess } from './dev-process.ts'
import { startFixtureRunner } from './fixture-runner.ts'

// Explicit verification command only: never runs during unit tests or installation.
const require = createRequire(import.meta.url)
await fs.mkdir('test-results', { recursive: true })
const logs: string[] = []
const runners: ReturnType<typeof startFixtureRunner>[] = []
let tests: ReturnType<typeof spawn> | undefined
let stopping = false
let backendFailed = false
async function cleanup() {
  stopping = true
  await Promise.all([
    ...runners.map((runner) => stopOwnedProcess(runner.process)),
    tests ? stopOwnedProcess(tests) : undefined,
  ])
  await fs.writeFile('test-results/dev-server.log', logs.join('\n'))
}
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    void cleanup().then(() => process.exit(1))
  })
try {
  for (const scenario of ['populated', 'empty', 'missing-backend']) {
    const runner = startFixtureRunner(scenario, (line) => {
      logs.push(`[${scenario}] ${line}`)
      console.log(`[${scenario}] ${line}`)
    })
    runners.push(runner)
    runner.process.once('exit', () => {
      if (!stopping) {
        backendFailed = true
        tests?.kill('SIGTERM')
      }
    })
  }
  const [populated, empty, missing] = await Promise.all(runners.map((runner) => runner.ready))
  tests = spawn(
    process.execPath,
    [require.resolve('@playwright/test/cli'), 'test', ...process.argv.slice(2)],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        LWE_BROWSER_URL: populated.url,
        LWE_BROWSER_EMPTY_URL: empty.url,
        LWE_BROWSER_MISSING_URL: missing.url,
      },
    },
  )
  const testExitCode = await new Promise<number>((resolve, reject) => {
    tests!.once('error', reject)
    tests!.once('exit', (code) => resolve(code ?? 1))
  })
  process.exitCode = backendFailed ? 1 : testExitCode
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  await cleanup()
}
