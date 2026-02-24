import { createFileRoute, useSearch } from "@tanstack/react-router"
import { Loader2 } from "lucide-react"
import { PlaylistEditorGrid } from "@/components/playlist/playlist-editor-grid"
import { trpc } from "@/lib/trpc"

interface PlaylistEditorSearch {
    name?: string
}

export const Route = createFileRoute("/playlists/editor")({
    validateSearch: (search: Record<string, unknown>): PlaylistEditorSearch => {
        return {
            name: typeof search.name === "string" ? search.name : undefined,
        }
    },
    component: PlaylistEditorPage,
})

function PlaylistEditorPage() {
    const { name } = useSearch({ from: "/playlists/editor" })

    const { data: playlist, isLoading } = trpc.playlist.get.useQuery(
        { name: name ?? "" },
        { enabled: !!name },
    )

    if (name && isLoading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="h-full p-6">
            <PlaylistEditorGrid editPlaylist={playlist ?? null} />
        </div>
    )
}
