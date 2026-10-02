import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import type { DevWebReady } from '../src/shared/constants/development.ts'

// Return the handle before readiness so failures/signals can always clean it up.
export function startFixtureRunner(scenario: string, log: (line: string) => void) {
  // Exercise the dedicated runner's development override even in a production shell.
  const processHandle = spawn(
    process.execPath,
    ['scripts/dev-runner.ts', '--fixtures', `--scenario=${scenario}`],
    { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NODE_ENV: 'production' } },
  )
  const ready = new Promise<DevWebReady>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`${scenario}: readiness timed out`)), 60000)
    processHandle.once('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    processHandle.once('exit', (code) => {
      clearTimeout(timeout)
      reject(new Error(`${scenario}: runner exited (${code})`))
    })
    processHandle.stderr.on('data', (chunk: Buffer) => log(chunk.toString()))
    createInterface({ input: processHandle.stdout }).on('line', (line) => {
      log(line)
      if (line.startsWith('LWE_WEB_READY ')) {
        clearTimeout(timeout)
        try {
          resolve(JSON.parse(line.slice(14)))
        } catch (error) {
          reject(error)
        }
      }
    })
  })
  return { process: processHandle, ready }
}
