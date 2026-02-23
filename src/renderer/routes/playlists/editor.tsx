import { createFileRoute, useSearch } from "@tanstack/react-router"
import { PlaylistEditorGrid } from "@/components/playlist/playlist-editor-grid"
import type { Playlist } from "../../../shared/constants"

interface PlaylistEditorSearch {
    edit?: Playlist
}

export const Route = createFileRoute("/playlists/editor")({
    validateSearch: (search: Record<string, unknown>): PlaylistEditorSearch => {
        return {
            edit: search.edit as Playlist | undefined,
        }
    },
    component: PlaylistEditorPage,
})

function PlaylistEditorPage() {
    const { edit } = useSearch({ from: "/playlists/editor" })

    return (
        <div className="h-full p-6">
            <PlaylistEditorGrid editPlaylist={edit ?? null} />
        </div>
    )
}
