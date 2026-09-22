export function WallpaperTags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null

  return (
    <div className="border-border mt-4 border-t pt-4">
      <p className="text-muted-foreground mb-2 text-sm font-medium">Tags</p>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="bg-secondary text-secondary-foreground rounded-full px-2.5 py-0.5 text-xs"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}
