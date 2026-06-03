import { hostExecAsync } from './host'

export type StatusNotifierWatcherStatus = 'available' | 'missing' | 'unknown'

const STATUS_NOTIFIER_WATCHER = 'org.kde.StatusNotifierWatcher'
const NAME_HAS_OWNER_COMMAND = [
  'gdbus',
  'call',
  '--session',
  '--dest org.freedesktop.DBus',
  '--object-path /org/freedesktop/DBus',
  '--method org.freedesktop.DBus.NameHasOwner',
  STATUS_NOTIFIER_WATCHER,
].join(' ')

export const getStatusNotifierWatcherStatus = async (): Promise<StatusNotifierWatcherStatus> => {
  if (process.platform !== 'linux') return 'unknown'

  try {
    const { stdout } = await hostExecAsync(NAME_HAS_OWNER_COMMAND)
    if (stdout.includes('true')) return 'available'
    if (stdout.includes('false')) return 'missing'
  } catch {
    return 'unknown'
  }

  return 'unknown'
}
