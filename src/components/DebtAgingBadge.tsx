import { cn } from '@/lib/utils'
import { ageBucket, formatAge } from '../lib/debtAge'

interface DebtAgingBadgeProps {
  daysOpen: number
  lastPaymentAt?: string | null
}

const styles: Record<'fresh' | 'warn' | 'overdue', string> = {
  fresh: 'bg-success/10 text-success',
  warn: 'bg-warning/10 text-warning',
  overdue: 'bg-destructive/10 text-destructive',
}

const labels: Record<'fresh' | 'warn' | 'overdue', string> = {
  fresh: 'Fresh',
  warn: 'Due soon',
  overdue: 'Overdue',
}

export function DebtAgingBadge({ daysOpen, lastPaymentAt }: DebtAgingBadgeProps) {
  const bucket = ageBucket(daysOpen)
  const title = lastPaymentAt ? `Sale ${daysOpen}d ago · Last payment ${new Date(lastPaymentAt).toLocaleDateString()}` : `Sale ${daysOpen}d ago`
  return (
    <span
      title={title}
      className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[0.8125rem] font-bold', styles[bucket])}
    >
      {labels[bucket]} · {formatAge(daysOpen)}
    </span>
  )
}