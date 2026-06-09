interface ColorControlProps {
    value: string
    onChange: (value: string) => void
}

// Native color picker styled to match the other setting controls. Value is a
// `#rrggbb` hex string; callers convert to/from domain formats at the call site.
export function ColorControl({ value, onChange }: ColorControlProps) {
    return (
        <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-7 w-12 cursor-pointer rounded border border-input bg-transparent"
        />
    )
}
