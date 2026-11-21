import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn, findOptionValue } from '@/lib/utils'

interface SelectControlProps<V extends string> {
  options: ReadonlyArray<{ readonly label: string; readonly value: V }>
  value: V
  onChange: (value: V) => void
  triggerClassName?: string
}

export function SelectControl<V extends string>({
  options,
  value,
  onChange,
  triggerClassName,
}: SelectControlProps<V>) {
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        const option = findOptionValue(options, next)
        if (option) onChange(option)
      }}
    >
      <SelectTrigger className={cn('max-w-48', triggerClassName)}>
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
