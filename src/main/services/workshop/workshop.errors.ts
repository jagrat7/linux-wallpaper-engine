import { TaggedError } from 'better-result'

export type WorkshopConnectionIssue = 'steam_not_running' | 'steam_not_logged_in' | 'steam_unavailable'

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

export function createWorkshopConnectionError(issue: WorkshopConnectionIssue): WorkshopConnectionError {
  switch (issue) {
    case 'steam_not_running':
      return new SteamNotRunningError()
    case 'steam_not_logged_in':
      return new SteamNotLoggedInError()
    case 'steam_unavailable':
      return new WorkshopUnavailableError()
  }
}

export function isWorkshopConnectionError(error: unknown): error is WorkshopConnectionError {
  return SteamNotRunningError.is(error)
    || SteamNotLoggedInError.is(error)
    || WorkshopUnavailableError.is(error)
}
