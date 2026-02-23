import { spawn, exec, type ChildProcess, type SpawnOptions } from 'node:child_process'
import { promisify } from 'node:util'
import * as fs from 'node:fs'

const execPromise = promisify(exec)

/**
 * Detect whether the app is running inside a Flatpak sandbox.
 * Flatpak sets `FLATPAK_ID` env var and mounts `/.flatpak-info`.
 */
export const isFlatpak = (): boolean =>
    !!process.env.FLATPAK_ID || fs.existsSync('/.flatpak-info')

/**
 * Spawn a process, routing through `flatpak-spawn --host` when inside a Flatpak.
 */
export const hostSpawn = (
    command: string,
    args: string[],
    options: SpawnOptions = {},
): ChildProcess => {
    if (isFlatpak()) {
        return spawn('flatpak-spawn', ['--host', command, ...args], options)
    }
    return spawn(command, args, options)
}

/**
 * Promisified exec that routes through `flatpak-spawn --host` when inside a Flatpak.
 */
export const hostExecAsync = (
    command: string,
): Promise<{ stdout: string; stderr: string }> => {
    const cmd = isFlatpak()
        ? `flatpak-spawn --host sh -c '${command.replace(/'/g, "'\\''")}'`
        : command
    return execPromise(cmd) as Promise<{ stdout: string; stderr: string }>
}
