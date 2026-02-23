import { createFileRoute, useSearch } from "@tanstack/react-router"
import { PlaylistEditorGrid } from "@/components/playlist/playlist-editor-grid"
import type { Playlist } from "../../../shared/constants"

interface PlaylistNewSearch {
    edit?: Playlist
}

export const Route = createFileRoute("/playlists/new")({
    validateSearch: (search: Record<string, unknown>): PlaylistNewSearch => {
        return {
            edit: search.edit as Playlist | undefined,
        }
    },
    component: PlaylistNewPage,
})

function PlaylistNewPage() {
    const { edit } = useSearch({ from: "/playlists/new" })

    return (
        <div className="h-full p-6">
            <PlaylistEditorGrid editPlaylist={edit ?? null} />
        </div>
    )
}
