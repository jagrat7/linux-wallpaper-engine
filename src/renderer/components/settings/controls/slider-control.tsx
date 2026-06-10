interface SliderControlProps {
    min: number
    max: number
    step?: number
    value: number
    onChange: (value: number) => void
    suffix?: string
}

export function SliderControl({ min, max, step, value, onChange, suffix }: SliderControlProps) {
    return (
        <div className="flex items-center gap-3">
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-24 accent-primary"
            />
            <span className="w-10 text-right text-xs text-muted-foreground">
                {value}{suffix}
            </span>
        </div>
    )
}
