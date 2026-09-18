import { Search } from 'lucide-react'
import { Input } from './ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'

/** Standard filter-area row used below every list-page header. */
export function FilterBar({ children }: { children: React.ReactNode }) {
  return <div className="flex w-full flex-wrap items-end gap-4">{children}</div>
}

/** Bordered filter card shared by DateRangeFilter and single-control filters. */
export function FilterCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex min-w-fit flex-1 flex-wrap items-end gap-4 rounded-[var(--radius-lg)] border border-border bg-card p-4 ${className ?? ''}`}>
      {children}
    </div>
  )
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  width = 'w-44',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  placeholder?: string
  width?: string
}) {
  return (
    <label className={`flex ${width} flex-col gap-1.5 text-[0.875rem] font-semibold`}>
      {label}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-11 w-full rounded-[var(--radius-md)]">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map(o => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  )
}

export function FilterSearch({
  value,
  onChange,
  placeholder = 'Search…',
  label = 'Search',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
}) {
  return (
    <label className="flex min-w-56 flex-1 flex-col gap-1.5 text-[0.875rem] font-semibold">
      {label}
      <span className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-11 rounded-[var(--radius-md)] bg-background pl-9 text-[0.875rem]"
        />
      </span>
    </label>
  )
}
