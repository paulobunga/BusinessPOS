import * as React from "react"
import { cn } from "cn"
import { format, isValid } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

const DATE_FORMAT = "yyyy-MM-dd"

function DatePicker({
  value,
  onValueChange,
  placeholder = "Pick a date",
  className,
  disabled = false,
}: {
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}) {
  const [open, setOpen] = React.useState(false)

  const selected = React.useMemo(() => {
    if (!value) return undefined
    const parsed = new Date(`${value}T00:00:00`)
    return isValid(parsed) ? parsed : undefined
  }, [value])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-8 w-full justify-start gap-2 rounded-[var(--radius-md)] px-2.5 font-normal",
            !value && "text-muted-foreground"
          )}
        >
          <CalendarIcon />
          {selected ? format(selected, DATE_FORMAT) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-fit p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(day) => {
            if (day) {
              onValueChange(format(day, DATE_FORMAT))
              setOpen(false)
            }
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker }