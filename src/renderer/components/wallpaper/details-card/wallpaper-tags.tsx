export function WallpaperTags({ tags }: { tags: string[] }) {
    if (tags.length === 0) return null

    return (
        <div className="mt-4 border-t border-border pt-4">
            <p className="mb-2 text-sm font-medium text-muted-foreground">Tags</p>
            <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                    <span
                        key={tag}
                        className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground"
                    >
                        {tag}
                    </span>
                ))}
            </div>
        </div>
    )
}
