import { atom } from "jotai"
import { atomWithStorage } from "jotai/utils"
import { DEFAULT_SETTINGS } from "../../../shared/constants/app"
import type { WorkshopSortBy } from "../../../shared/constants/workshop"
import type { AgeRating, WallpaperFilterType } from "../../../shared/constants/wallpaper"

export type WorkshopMode = "discover" | "browse"

export const workshopModeAtom = atomWithStorage<WorkshopMode>("workshop-mode", "discover")

export const workshopSearchQueryAtom = atom("")
export const workshopFilterTypeAtom = atom<WallpaperFilterType[]>([...DEFAULT_SETTINGS.workshopFilterType])
export const workshopFilterAgeRatingAtom = atom<AgeRating[]>([...DEFAULT_SETTINGS.workshopFilterAgeRating])
export const workshopFilterTagsAtom = atom<string[]>([...DEFAULT_SETTINGS.workshopFilterTags])
export const workshopFilterResolutionAtom = atom<string[]>([...DEFAULT_SETTINGS.workshopFilterResolution])
export const workshopSortByAtom = atom<WorkshopSortBy>(DEFAULT_SETTINGS.workshopSortBy)

export const unsubscribedWorkshopIdsAtom = atom<Set<string>>(new Set<string>())

export const addUnsubscribedWorkshopIdAtom = atom(null, (_get, set, workshopId: string) => {
  set(unsubscribedWorkshopIdsAtom, (previousIds: Set<string>) => {
    const nextIds = new Set(previousIds)
    nextIds.add(workshopId)
    return nextIds
  })
})

export const removeUnsubscribedWorkshopIdAtom = atom(null, (_get, set, workshopId: string) => {
  set(unsubscribedWorkshopIdsAtom, (previousIds: Set<string>) => {
    const nextIds = new Set(previousIds)
    nextIds.delete(workshopId)
    return nextIds
  })
})
