import { useCallback, useRef, useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { rgbToHex } from "@/lib/utils"
import {
    ColorPicker,
    type ColorPickerProps,
    ColorPickerHue,
    ColorPickerSelection,
} from "@/components/ui/kibo-ui/color-picker"

const HEX_PATTERN = /^#?([0-9a-f]{6})$/i

interface ColorControlProps {
    value: string
    onChange: (value: string) => void
}

const SWATCHES = [
    "#ffffff", "#000000", "#ef4444", "#f97316", "#eab308",
    "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
] as const

export function ColorControl({ value, onChange }: ColorControlProps) {
    const onChangeRef = useRef(onChange)
    onChangeRef.current = onChange
    // Bumped when a color is applied directly (swatch/hex input) so the picker
    // remounts showing it; `hex` is carried along because the parent `value`
    // prop only updates on a later render.
    const [seed, setSeed] = useState<{ key: number; hex: string | null }>({ key: 0, hex: null })

    // Identity must stay stable or the picker's emit effect re-fires on every
    // render with the same color.
    const handleChange = useCallback<NonNullable<ColorPickerProps["onChange"]>>((rgb) => {
        const [r, g, b] = rgb as number[]
        onChangeRef.current(rgbToHex(r, g, b))
    }, [])

    // Draft of the hex field while the user is typing; null shows `value`.
    const [hexDraft, setHexDraft] = useState<string | null>(null)

    const applyColor = (hex: string) => {
        setSeed((s) => ({ key: s.key + 1, hex }))
        onChange(hex)
    }

    const handleHexInput = (text: string) => {
        setHexDraft(text)
        const match = HEX_PATTERN.exec(text.trim())
        if (match) applyColor(`#${match[1].toLowerCase()}`)
    }

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="h-7 w-12 cursor-pointer rounded border border-input"
                    style={{ backgroundColor: value }}
                    aria-label="Pick color"
                />
            </PopoverTrigger>
            <PopoverContent className="flex w-auto flex-col gap-3 p-3" align="end">
                <ColorPicker key={seed.key} defaultValue={seed.hex ?? value} onChange={handleChange} className="w-56 gap-3">
                    <ColorPickerSelection className="h-36" />
                    <ColorPickerHue />
                </ColorPicker>
                <div className="flex gap-1">
                    {SWATCHES.map((hex) => (
                        <button
                            key={hex}
                            type="button"
                            onClick={() => applyColor(hex)}
                            className="aspect-square min-w-0 flex-1 cursor-pointer rounded-full border border-input transition-transform hover:scale-110"
                            style={{ backgroundColor: hex }}
                            aria-label={`Use ${hex}`}
                        />
                    ))}
                </div>
                <Input
                    type="text"
                    value={hexDraft ?? value}
                    onChange={(e) => handleHexInput(e.target.value)}
                    onBlur={() => setHexDraft(null)}
                    className="h-8 bg-secondary px-2 text-xs shadow-none"
                    spellCheck={false}
                    aria-label="Hex color"
                />
            </PopoverContent>
        </Popover>
    )
}
