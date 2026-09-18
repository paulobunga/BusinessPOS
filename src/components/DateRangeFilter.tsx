import { DatePicker } from './ui/date-picker'
import { Button } from './ui/button'
import { FilterCard } from './FilterBar'

interface DateRangeFilterProps {
  dateFrom: string
  dateTo: string
  onDateFromChange: (val: string) => void
  onDateToChange: (val: string) => void
  onReset: () => void
  className?: string
  children?: React.ReactNode
}

export function DateRangeFilter({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onReset,
  className,
  children,
}: DateRangeFilterProps) {
  return (
    <FilterCard className={className}>
      <label className="flex w-44 flex-col gap-1.5 text-[0.875rem] font-semibold">
        Date From
        <DatePicker value={dateFrom} onValueChange={onDateFromChange} />
      </label>
      <label className="flex w-44 flex-col gap-1.5 text-[0.875rem] font-semibold">
        Date To
        <DatePicker value={dateTo} onValueChange={onDateToChange} />
      </label>
      {children}
      <Button onClick={onReset} variant="outline" className="h-11">
        Reset
      </Button>
    </FilterCard>
  )
}
