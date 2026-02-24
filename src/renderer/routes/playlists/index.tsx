import { useState, useMemo, useRef, useEffect } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Plus, Shuffle, Loader2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { trpc } from "@/lib/trpc"
import { type Playlist } from "../../../shared/constants"
import { PlaylistRow } from "@/components/playlist/playlist-row"
import { PageHeader } from "@/components/page-header"
import { Input } from "@/components/ui/input"

export const Route = createFileRoute("/playlists/")({
    component: PlaylistsPage,
})

function PlaylistsPage() {
    const navigate = useNavigate()
    const [applyingPlaylist, setApplyingPlaylist] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [isSearchOpen, setIsSearchOpen] = useState(false)
    const searchInputRef = useRef<HTMLInputElement>(null)

    const handleSearchOpen = () => {
        setIsSearchOpen(true)
        setTimeout(() => searchInputRef.current?.focus(), 50)
    }

    const handleSearchClose = () => {
        if (searchQuery.trim() === "") {
            setIsSearchOpen(false)
        }
    }

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "f" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                handleSearchOpen()
            }
        }
        window.addEventListener("keydown", onKeyDown)
        return () => window.removeEventListener("keydown", onKeyDown)
    }, [])

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
        navigate({ to: "/playlists/editor", search: { name: playlist.name } })
    }

    const handleCreate = () => {
        navigate({ to: "/playlists/editor" })
    }

    const filteredPlaylists = useMemo(() => {
        const query = searchQuery.trim().toLowerCase()
        if (!query) return playlists
        return playlists.filter(p => p.name.toLowerCase().includes(query))
    }, [playlists, searchQuery])

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

            {playlists.length > 0 && (
                <div className="mb-4 flex justify-start">
                    <div className={`group relative flex items-center overflow-hidden transition-all duration-300 ease-in-out rounded-xl ${isSearchOpen
                        ? "w-72 ring-1 ring-foreground/20 focus-within:ring-foreground/40 focus-within:shadow-sm glass"
                        : "w-8"
                        }`}>
                        <button
                            onClick={isSearchOpen ? undefined : handleSearchOpen}
                            className="absolute left-0 flex size-8 shrink-0 items-center justify-center text-muted-foreground/40 hover:text-muted-foreground transition-colors duration-200"
                            aria-label="Search playlists"
                        >
                            <Search className="size-4" />
                        </button>
                        <Input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Search playlists..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onBlur={handleSearchClose}
                            onKeyDown={(e) => e.key === "Escape" && handleSearchClose()}
                            className="h-8 w-full border-0 bg-transparent pl-9 pr-4 text-sm font-medium tracking-wide text-foreground placeholder:text-muted-foreground/50 transition-all duration-200 focus:ring-0"
                        />
                    </div>
                </div>
            )}

            {filteredPlaylists.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                    <Shuffle className="size-12 mb-4 opacity-50" />
                    <p className="text-lg font-medium">{searchQuery ? "No matching playlists" : "No playlists yet"}</p>
                    <p className="text-sm">{searchQuery ? "Try a different search term" : "Create a playlist to rotate wallpapers automatically"}</p>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {filteredPlaylists.map((playlist) => {
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
