import { useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Plus, Shuffle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { trpc } from "@/lib/trpc"
import { type Playlist } from "../../../shared/constants"
import { PlaylistRow } from "@/components/playlist/playlist-row"
import { PageHeader } from "@/components/page-header"

export const Route = createFileRoute("/playlists/")({
    component: PlaylistsPage,
})

function PlaylistsPage() {
    const navigate = useNavigate()
    const [applyingPlaylist, setApplyingPlaylist] = useState<string | null>(null)

    const { data: playlists = [], isLoading, refetch } = trpc.playlist.list.useQuery()
    const { data: wallpapers = [] } = trpc.wallpaper.getWallpapers.useQuery({})
    const { data: activePlaylist } = trpc.playlist.active.useQuery(undefined, {
        refetchInterval: 5000,
    })
    const deleteMutation = trpc.playlist.delete.useMutation()
    const applyMutation = trpc.playlist.start.useMutation()
    const stopMutation = trpc.playlist.stop.useMutation()
    const stopWallpaperMutation = trpc.wallpaper.stopWalpaper.useMutation()
    const utils = trpc.useUtils()

    const handleApply = async (playlistName: string, screen?: string) => {
        setApplyingPlaylist(playlistName)
        try {
            await applyMutation.mutateAsync({ playlistName, screen })
            await utils.playlist.active.invalidate()
        } finally {
            setApplyingPlaylist(null)
        }
    }

    const handleStop = async (screen?: string) => {
        if (screen) {
            await stopWallpaperMutation.mutateAsync({ screen })
        } else {
            await stopMutation.mutateAsync()
        }
        await utils.playlist.active.invalidate()
        await utils.wallpaper.getActiveWallpaper.invalidate()
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

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="p-6">
            <PageHeader
                title="Playlists"
                description="Create wallpaper rotations with custom timing"
                action={
                    <Button
                        size="sm"
                        className="gap-2 flex justify-center items-center"
                        onClick={handleCreate}
                    >
                        <Plus className="size-4" />
                        New Playlist
                    </Button>
                }
            />

            {playlists.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                    <Shuffle className="size-12 mb-4 opacity-50" />
                    <p className="text-lg font-medium">No playlists yet</p>
                    <p className="text-sm">Create a playlist to rotate wallpapers automatically</p>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {playlists.map((playlist) => {
                        const isApplying = applyingPlaylist === playlist.name
                        const isActive = activePlaylist?.name === playlist.name

                        return (
                            <PlaylistRow
                                key={playlist.name}
                                playlist={playlist}
                                wallpapers={wallpapers}
                                isApplying={isApplying}
                                isActive={isActive}
                                onApply={(screen) => handleApply(playlist.name, screen)}
                                onStop={handleStop}
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
