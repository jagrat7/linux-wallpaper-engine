import { atomWithStorage } from "jotai/utils"

export type WorkshopMode = "discover" | "browse"

export const workshopModeAtom = atomWithStorage<WorkshopMode>("workshop-mode", "discover")
