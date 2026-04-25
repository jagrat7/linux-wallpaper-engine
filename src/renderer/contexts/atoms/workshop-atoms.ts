import { atom } from "jotai"
import { atomWithStorage } from "jotai/utils"
import type { WorkshopSortBy } from "../../../shared/constants/workshop"
import type { AgeRating, WallpaperFilterType } from "../../../shared/constants/wallpaper"

export type WorkshopMode = "discover" | "browse"

export const workshopModeAtom = atomWithStorage<WorkshopMode>("workshop-mode", "discover")

export const workshopSearchQueryAtom = atom("")
export const workshopFilterTypeAtom = atom<WallpaperFilterType[]>([])
export const workshopFilterAgeRatingAtom = atom<AgeRating[]>([])
export const workshopFilterTagsAtom = atom<string[]>([])
export const workshopFilterResolutionAtom = atom<string[]>([])
export const workshopSortByAtom = atom<WorkshopSortBy>("trend")

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
