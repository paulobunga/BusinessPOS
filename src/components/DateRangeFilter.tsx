import { DatePicker } from './ui/date-picker'
import { Button } from './ui/button'

interface DateRangeFilterProps {
  dateFrom: string
  dateTo: string
  onDateFromChange: (val: string) => void
  onDateToChange: (val: string) => void
  onReset: () => void
  className?: string
}

export function DateRangeFilter({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onReset,
  className,
}: DateRangeFilterProps) {
  return (
    <div className={`flex flex-wrap items-end gap-4 rounded-[var(--radius-lg)] border border-border bg-card p-4 ${className ?? ''}`}>
      <label className="flex w-44 flex-col gap-1.5 text-[0.875rem] font-semibold">
        Date From
        <DatePicker value={dateFrom} onValueChange={onDateFromChange} />
      </label>
      <label className="flex w-44 flex-col gap-1.5 text-[0.875rem] font-semibold">
        Date To
        <DatePicker value={dateTo} onValueChange={onDateToChange} />
      </label>
      <Button onClick={onReset} variant="outline" className="h-11">
        Reset
      </Button>
    </div>
  )
}
