import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type RefCallback } from "react"

interface WallpaperGridNavigationOptions {
    itemIds: string[]
    columns: number
    onNavigate?: (index: number) => void
}

interface WallpaperGridItemProps {
    tabIndex: number
    buttonRef: RefCallback<HTMLButtonElement>
    onFocus: () => void
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void
}

export function useWallpaperGridNavigation({
    itemIds,
    columns,
    onNavigate,
}: WallpaperGridNavigationOptions) {
    const itemRefs = useRef(new Map<string, HTMLButtonElement>())
    const lastIndexRef = useRef(0)
    const [activeId, setActiveId] = useState<string | null>(itemIds[0] ?? null)
    const idToIndex = useMemo(
        () => new Map(itemIds.map((id, index) => [id, index])),
        [itemIds],
    )

    useEffect(() => {
        if (activeId && idToIndex.has(activeId)) return

        const nextIndex = Math.min(lastIndexRef.current, itemIds.length - 1)
        setActiveId(nextIndex >= 0 ? itemIds[nextIndex] : null)
    }, [activeId, idToIndex, itemIds])

    const focusIndex = useCallback((index: number) => {
        const nextIndex = Math.max(0, Math.min(index, itemIds.length - 1))
        const nextId = itemIds[nextIndex]
        if (!nextId) return

        lastIndexRef.current = nextIndex
        setActiveId(nextId)
        onNavigate?.(nextIndex)

        requestAnimationFrame(() => {
            requestAnimationFrame(() => itemRefs.current.get(nextId)?.focus())
        })
    }, [itemIds, onNavigate])

    const focusId = useCallback((id: string) => {
        const index = idToIndex.get(id)
        if (index === undefined) return
        focusIndex(index)
    }, [focusIndex, idToIndex])

    const getItemProps = useCallback((id: string, index: number): WallpaperGridItemProps => ({
        tabIndex: activeId === id ? 0 : -1,
        buttonRef: (node) => {
            if (node) itemRefs.current.set(id, node)
            else itemRefs.current.delete(id)
        },
        onFocus: () => {
            lastIndexRef.current = index
            setActiveId(id)
        },
        onKeyDown: (event) => {
            const rowStart = Math.floor(index / columns) * columns
            const rowEnd = Math.min(rowStart + columns - 1, itemIds.length - 1)
            let nextIndex = index

            if (event.key === "ArrowLeft" && index > rowStart) nextIndex = index - 1
            else if (event.key === "ArrowRight" && index < rowEnd) nextIndex = index + 1
            else if (event.key === "ArrowUp" && index >= columns) nextIndex = index - columns
            else if (event.key === "ArrowDown" && index + columns < itemIds.length) nextIndex = index + columns
            else if (event.key === "Home") nextIndex = event.metaKey || event.ctrlKey ? 0 : rowStart
            else if (event.key === "End") nextIndex = event.metaKey || event.ctrlKey ? itemIds.length - 1 : rowEnd
            else return

            event.preventDefault()
            if (nextIndex === index) return
            focusIndex(nextIndex)
        },
    }), [activeId, columns, focusIndex, itemIds.length])

    return { activeId, focusId, getItemProps }
}
