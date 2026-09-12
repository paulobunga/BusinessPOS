import * as React from "react"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "cn"

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

function isSameDay(a?: Date, b?: Date): boolean {
  return !!(a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate())
}

interface GridCell {
  date: Date
  outside: boolean
}

function getMonthGrid(viewDate: Date): GridCell[] {
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const startWeekday = firstOfMonth.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const cells: GridCell[] = []

  for (let i = startWeekday - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month - 1, daysInPrevMonth - i), outside: true })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), outside: false })
  }
  while (cells.length < 42) {
    const last = cells[cells.length - 1].date
    const next = new Date(last)
    next.setDate(next.getDate() + 1)
    cells.push({ date: next, outside: true })
  }

  return cells
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

function Calendar({ selected, onSelect }: { selected?: Date; onSelect: (d: Date) => void }) {
  const [viewDate, setViewDate] = React.useState(selected ?? new Date())
  const today = new Date()

  const cells = getMonthGrid(viewDate)
  const monthLabel = viewDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })

  const goToMonth = (offset: number) => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1))
  }

  return (
    <div className="w-[280px] select-none p-3">
      <div className="flex items-center justify-between pb-2">
        <button
          type="button"
          onClick={() => goToMonth(-1)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] border border-border bg-transparent text-muted-foreground opacity-80 transition hover:bg-muted hover:opacity-100"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-sm font-medium">{monthLabel}</div>
        <button
          type="button"
          onClick={() => goToMonth(1)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] border border-border bg-transparent text-muted-foreground opacity-80 transition hover:bg-muted hover:opacity-100"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {WEEKDAYS.map(wd => (
          <div key={wd} className="flex h-8 items-center justify-center text-[0.8rem] font-normal text-muted-foreground">
            {wd}
          </div>
        ))}

        {cells.map(({ date, outside }, i) => {
          const selectedDay = isSameDay(date, selected)
          const isToday = isSameDay(date, today)

          return (
            <div key={i} className="flex items-center justify-center">
              <button
                type="button"
                onClick={() => onSelect(date)}
                className={cn(
                  "h-8 w-8 rounded-[var(--radius-md)] text-sm font-normal transition-colors",
                  outside ? "text-muted-foreground/60" : "text-foreground",
                  !selectedDay && !outside && "hover:bg-muted",
                  selectedDay && "bg-primary text-primary-foreground hover:bg-primary",
                  isToday && !selectedDay && "ring-1 ring-inset ring-border"
                )}
              >
                {date.getDate()}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

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
  const containerRef = React.useRef<HTMLDivElement>(null)

  const selected = React.useMemo(() => {
    if (!value) return undefined
    const parsed = new Date(`${value}T00:00:00`)
    return isNaN(parsed.getTime()) ? undefined : parsed
  }, [value])

  const handleSelect = (d: Date) => {
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const dd = String(d.getDate()).padStart(2, "0")
    onValueChange(`${yyyy}-${mm}-${dd}`)
    setOpen(false)
  }

  // close on outside click / Escape
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    if (open) {
      document.addEventListener("mousedown", handleClick)
      document.addEventListener("keydown", handleEscape)
    }
    return () => {
      document.removeEventListener("mousedown", handleClick)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [open])

  return (
    <div className={cn("relative inline-block", className)} ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        className={cn(
          "inline-flex h-11 w-full items-center justify-start gap-2 rounded-[var(--radius-md)] border border-border bg-card px-3 py-2 text-[0.875rem] font-normal shadow-sm transition-colors",
          "hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
          disabled && "cursor-not-allowed opacity-60",
          value ? "text-foreground" : "text-muted-foreground"
        )}
      >
        <CalendarIcon className="h-4 w-4 shrink-0 opacity-70" />
        {selected ? formatDate(selected) : placeholder}
      </button>

      {open && !disabled && (
        <div
          role="dialog"
          className="absolute z-50 mt-2 rounded-[var(--radius-lg)] border border-border bg-card shadow-md"
        >
          <Calendar selected={selected} onSelect={handleSelect} />
        </div>
      )}
    </div>
  )
}

export { DatePicker }