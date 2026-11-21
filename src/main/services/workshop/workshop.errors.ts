import { TaggedError } from 'better-result'

export type WorkshopConnectionIssue =
  | 'steam_not_running'
  | 'steam_not_logged_in'
  | 'steam_unavailable'

export class SteamNotRunningError extends TaggedError('SteamNotRunningError')<{
  message: string
}>() {
  constructor() {
    super({
      message: 'Start Steam app to browse Workshop items.',
    })
  }
}

export class SteamNotLoggedInError extends TaggedError('SteamNotLoggedInError')<{
  message: string
}>() {
  constructor() {
    super({
      message: 'Log in to Steam to browse Workshop items.',
    })
  }
}

export class WorkshopUnavailableError extends TaggedError('WorkshopUnavailableError')<{
  message: string
}>() {
  constructor() {
    super({
      message: 'Steam Workshop is unavailable. Start Steam and log in, then try again.',
    })
  }
}

export type WorkshopConnectionError =
  | SteamNotRunningError
  | SteamNotLoggedInError
  | WorkshopUnavailableError

const WORKSHOP_CONNECTION_ERRORS: Record<WorkshopConnectionIssue, () => WorkshopConnectionError> = {
  steam_not_running: () => new SteamNotRunningError(),
  steam_not_logged_in: () => new SteamNotLoggedInError(),
  steam_unavailable: () => new WorkshopUnavailableError(),
}

export function createWorkshopConnectionError(
  issue: WorkshopConnectionIssue,
): WorkshopConnectionError {
  return WORKSHOP_CONNECTION_ERRORS[issue]()
}

export function isWorkshopConnectionError(error: unknown): error is WorkshopConnectionError {
  return (
    SteamNotRunningError.is(error) ||
    SteamNotLoggedInError.is(error) ||
    WorkshopUnavailableError.is(error)
  )
}
