import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface SelectControlProps {
    options: ReadonlyArray<{ readonly label: string; readonly value: string }>
    value: string
    onChange: (value: string) => void
    triggerClassName?: string
}

export function SelectControl({ options, value, onChange, triggerClassName }: SelectControlProps) {
    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className={cn("max-w-48", triggerClassName)}>
                {/* The trigger's built-in line-clamp doesn't apply (its value
                    slot is forced to display:flex), so truncate explicitly. */}
                <span className="min-w-0 truncate">
                    <SelectValue />
                </span>
            </SelectTrigger>
            <SelectContent position="popper" className="max-w-64">
                {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                        <span className="block truncate">{option.label}</span>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}
