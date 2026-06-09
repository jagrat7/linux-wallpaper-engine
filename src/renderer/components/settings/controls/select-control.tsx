import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface SelectControlProps {
    options: ReadonlyArray<{ readonly label: string; readonly value: string }>
    value: string
    onChange: (value: string) => void
    triggerClassName?: string
}

export function SelectControl({ options, value, onChange, triggerClassName }: SelectControlProps) {
    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className={triggerClassName}>
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                        {option.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}
