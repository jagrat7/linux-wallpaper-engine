import * as React from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Plus, Clock, Shuffle, MoreVertical, Pencil, Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { trpc } from "@/lib/trpc"
import { type Playlist } from "../../../shared/constants"
import { ApplyButton } from "@/components/wallpaper/apply-button"

export const Route = createFileRoute("/playlists/")({
    component: PlaylistsPage,
})

function PlaylistsPage() {
    const navigate = useNavigate()
    const [applyingPlaylist, setApplyingPlaylist] = React.useState<string | null>(null)

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
        navigate({ to: "/playlists/new", search: { edit: playlist } })
    }

    const handleCreate = () => {
        navigate({ to: "/playlists/new" })
    }

    const getThumbnailForPlaylist = (playlist: Playlist): string | null => {
        const firstItem = playlist.items[0]
        if (!firstItem) return null
        const wallpaper = wallpapers.find(w => w.path === firstItem)
        return wallpaper?.thumbnail ?? null
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
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {playlists.map((playlist) => {
                        const thumbnail = getThumbnailForPlaylist(playlist)
                        const isApplying = applyingPlaylist === playlist.name

                        return (
                            <div
                                key={playlist.name}
                                className="group relative overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-ring/50 hover:shadow-lg"
                            >
                                <div className="aspect-video overflow-hidden bg-muted">
                                    {thumbnail ? (
                                        <img
                                            src={`local-file://${thumbnail}`}
                                            alt={playlist.name}
                                            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                                        />
                                    ) : (
                                        <div className="size-full flex items-center justify-center">
                                            <Shuffle className="size-8 text-muted-foreground" />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                                </div>

                                <div className="absolute inset-x-0 bottom-0 p-4">
                                    <h3 className="font-semibold text-white">{playlist.name}</h3>
                                    <div className="mt-1 flex items-center gap-3 text-sm text-white/70">
                                        <span>{playlist.items.length} wallpapers</span>
                                        <div className="flex items-center gap-1">
                                            <Clock className="size-3" />
                                            {playlist.settings.delay}m
                                        </div>
                                        {playlist.settings.order === 'random' && (
                                            <Shuffle className="size-3" />
                                        )}
                                    </div>
                                </div>

                                <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button size="icon-sm" variant="secondary" className="size-8">
                                                <MoreVertical className="size-3.5" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => handleEdit(playlist)}>
                                                <Pencil className="size-4" />
                                                Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                className="text-destructive"
                                                onClick={() => handleDelete(playlist.name)}
                                            >
                                                <Trash2 className="size-4" />
                                                Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>

                                {/* Apply button */}
                                <div className="absolute left-3 top-3 opacity-0 transition-opacity group-hover:opacity-100">
                                    <ApplyButton
                                        onApply={(screen) => handleApply(playlist.name, screen)}
                                        isApplying={isApplying}
                                        size="sm"
                                    />
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

        </div>
    )
}
