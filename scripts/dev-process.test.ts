import { spawn } from 'node:child_process'
import { expect, it } from 'vite-plus/test'
import { stopOwnedProcess } from './dev-process'

it('terminates only the captured child and handles an already exited process', async () => {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' })
  await new Promise<void>((resolve) => child.once('spawn', resolve))
  await stopOwnedProcess(child)
  expect(child.signalCode).toBe('SIGTERM')
  await stopOwnedProcess(child)
})
