import { spawn, exec, execFile, type ChildProcess, type SpawnOptions } from 'node:child_process'
import { promisify } from 'node:util'

const execPromise = promisify(exec)
const execFilePromise = promisify(execFile)

export const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const backendArgPattern = (flag: string, value: string): string =>
  `linux-wallpaperengine.*${escapeRegExp(flag)} ${escapeRegExp(value)}( |$)`

/**
 * Spawn a command. Kept as a wrapper so services share one spawn seam that tests can mock.
 */
export const hostSpawn = (
  command: string,
  args: string[],
  options: SpawnOptions = {},
): ChildProcess => spawn(command, args, options)

/**
 * Promisified exec. The command runs through a shell, so only pass trusted input.
 */
export const hostExecAsync = (command: string): Promise<{ stdout: string; stderr: string }> =>
  execPromise(command) as Promise<{ stdout: string; stderr: string }>

/**
 * Promisified execFile. The command is never run through a shell: arguments
 * are passed verbatim as an argv array, so inputs containing shell
 * metacharacters can't inject commands.
 */
export const hostExecFileAsync = (
  file: string,
  args: string[],
): Promise<{ stdout: string; stderr: string }> =>
  execFilePromise(file, args) as Promise<{ stdout: string; stderr: string }>

export const hostCommandExists = async (command: string): Promise<boolean> => {
  try {
    await hostExecAsync(`command -v ${command}`)
    return true
  } catch {
    return false
  }
}
