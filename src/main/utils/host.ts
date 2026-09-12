import { spawn, exec, execFile, type ChildProcess, type SpawnOptions } from 'node:child_process'
import { promisify } from 'node:util'
import * as fs from 'node:fs'

const execPromise = promisify(exec)
const execFilePromise = promisify(execFile)

/**
 * Detect whether the app is running inside a Flatpak sandbox.
 * Flatpak sets `FLATPAK_ID` env var and mounts `/.flatpak-info`.
 */
export const isFlatpak = (): boolean =>
    !!process.env.FLATPAK_ID || fs.existsSync('/.flatpak-info')

/**
 * Returns the process Flatpak ID or the default one set in forge.config
 */
export const getFlatpakID = (): string =>
    process.env.FLATPAK_ID || 'com.github.jagrat7.LinuxWallpaperEngine'

/**
 * Environment variables that must be forwarded to host processes via flatpak-spawn.
 * Without these, graphical apps like linux-wallpaperengine can't connect to the display server.
 */
const HOST_ENV_VARS = [
    'DISPLAY',
    'WAYLAND_DISPLAY',
    'XDG_RUNTIME_DIR',
    'XDG_SESSION_TYPE',
    'DBUS_SESSION_BUS_ADDRESS',
] as const

/**
 * Build `--env=KEY=VALUE` args for flatpak-spawn from the current environment.
 */
const getEnvForwardArgs = (): string[] =>
    HOST_ENV_VARS.flatMap((key) => {
        const value = process.env[key]
        return value != null ? [`--env=${key}=${value}`] : []
    })

let flatpakBypass = false

/**
 * Enable or disable Flatpak bypass mode.
 * When enabled, commands run directly without flatpak-spawn --host.
 */
export const setFlatpakBypass = (enabled: boolean): void => {
    flatpakBypass = enabled
}

export const getFlatpakBypass = (): boolean => flatpakBypass

/**
 * Whether to use flatpak-spawn for this call (inside Flatpak and not bypassed).
 */
const shouldUseFlatpakSpawn = (): boolean =>
    isFlatpak() && !flatpakBypass

/**
 * Exported so callers can avoid paths that assume a directly-owned child
 * process — under Flatpak, ChildProcess handles wrap `flatpak-spawn` rather
 * than the real host process.
 */
export const usesFlatpakSpawn = (): boolean => shouldUseFlatpakSpawn()

/**
 * Spawn a process, routing through `flatpak-spawn --host` when inside a Flatpak.
 */
export const hostSpawn = (
    command: string,
    args: string[],
    options: SpawnOptions = {},
): ChildProcess => {
    if (shouldUseFlatpakSpawn()) {
        return spawn('flatpak-spawn', [...getEnvForwardArgs(), '--host', command, ...args], options)
    }
    return spawn(command, args, options)
}

/**
 * Promisified exec that routes through `flatpak-spawn --host` when inside a Flatpak.
 */
export const hostExecAsync = (
    command: string,
): Promise<{ stdout: string; stderr: string }> => {
    const envArgs = getEnvForwardArgs().join(' ')
    const cmd = shouldUseFlatpakSpawn()
        ? `flatpak-spawn ${envArgs} --host sh -c '${command.replace(/'/g, "'\\''")}'`
        : command
    return execPromise(cmd) as Promise<{ stdout: string; stderr: string }>
}

/**
 * Promisified execFile that routes through `flatpak-spawn --host` when inside
 * a Flatpak. Unlike hostExecAsync, the command is never run through a shell —
 * arguments are passed verbatim as an argv array, so inputs containing shell
 * metacharacters can't inject commands.
 */
export const hostExecFileAsync = (
    file: string,
    args: string[],
): Promise<{ stdout: string; stderr: string }> => {
    if (shouldUseFlatpakSpawn()) {
        return new Promise((resolve, reject) => {
            const proc = spawn('flatpak-spawn', [...getEnvForwardArgs(), '--host', file, ...args], {
                stdio: ['ignore', 'pipe', 'pipe'],
            })
            let stdout = ''
            let stderr = ''
            proc.stdout?.on('data', (chunk) => { stdout += chunk })
            proc.stderr?.on('data', (chunk) => { stderr += chunk })
            proc.on('error', reject)
            proc.on('close', (code) => {
                if (code === 0) {
                    resolve({ stdout, stderr })
                } else {
                    reject(new Error(`${file} exited with code ${code}`))
                }
            })
        })
    }
    return execFilePromise(file, args) as Promise<{ stdout: string; stderr: string }>
}

export const hostCommandExists = async (command: string): Promise<boolean> => {
    try {
        await hostExecAsync(`command -v ${command}`)
        return true
    } catch {
        return false
    }
}
