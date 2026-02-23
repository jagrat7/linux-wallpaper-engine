import { useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Plus, Shuffle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { trpc } from "@/lib/trpc"
import { type Playlist } from "../../../shared/constants"
import { PlaylistCard } from "@/components/playlist/playlist-card"

export const Route = createFileRoute("/playlists/")({
    component: PlaylistsPage,
})

function PlaylistsPage() {
    const navigate = useNavigate()
    const [applyingPlaylist, setApplyingPlaylist] = useState<string | null>(null)

    const { data: playlists = [], isLoading, refetch } = trpc.playlist.list.useQuery()
    const { data: wallpapers = [] } = trpc.wallpaper.getWallpapers.useQuery({})
    const deleteMutation = trpc.playlist.delete.useMutation()
    const applyMutation = trpc.playlist.start.useMutation()

    const handleApply = async (playlistName: string, screen?: string) => {
        setApplyingPlaylist(playlistName)
        try {
            await applyMutation.mutateAsync({ playlistName, screen })
        } finally {
            setApplyingPlaylist(null)
        }
    }

    const handleDelete = async (name: string) => {
        await deleteMutation.mutateAsync({ name })
        refetch()
    }

    const handleEdit = (playlist: Playlist) => {
        navigate({ to: "/playlists/editor", search: { edit: playlist } })
    }

    const handleCreate = () => {
        navigate({ to: "/playlists/editor" })
    }

    const getWallpapersForPlaylist = (playlist: Playlist) => {
        return playlist.items
            .map(path => wallpapers.find(w => w.path === path))
            .filter((w): w is NonNullable<typeof w> => w !== null)
    }

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="p-6">
            <div className="mb-6 flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Playlists</h1>
                    <p className="text-muted-foreground">
                        Create wallpaper rotations with custom timing
                    </p>
                </div>
                <Button
                    size="sm"
                    className="gap-2"
                    onClick={handleCreate}
                >
                    <Plus className="size-4" />
                    New Playlist
                </Button>
            </div>

            {playlists.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                    <Shuffle className="size-12 mb-4 opacity-50" />
                    <p className="text-lg font-medium">No playlists yet</p>
                    <p className="text-sm">Create a playlist to rotate wallpapers automatically</p>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {playlists.map((playlist) => {
                        const playlistWallpapers = getWallpapersForPlaylist(playlist)
                        const isApplying = applyingPlaylist === playlist.name

                        return (
                            <PlaylistCard
                                key={playlist.name}
                                playlist={playlist}
                                wallpapers={playlistWallpapers}
                                isApplying={isApplying}
                                onApply={(screen) => handleApply(playlist.name, screen)}
                                onEdit={() => handleEdit(playlist)}
                                onDelete={() => handleDelete(playlist.name)}
                            />
                        )
                    })}
                </div>
            )}

        </div>
    )
}
