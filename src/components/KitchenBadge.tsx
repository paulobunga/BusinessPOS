import { cn } from '@/lib/utils'
import type { KitchenStatus } from '../../shared/kitchen'

export function KitchenBadge({ status }: { status: KitchenStatus }) {
  return (
    <span
      className={cn(
        'rounded-full border px-2 py-0.5 text-[0.75rem] font-bold',
        status === 'new' && 'border-warning/40 bg-warning/10 text-warning',
        status === 'preparing' && 'border-primary/40 bg-primary/10 text-primary',
        status === 'completed' && 'border-success/40 bg-success/10 text-success',
        status === 'served' && 'border-border bg-muted text-muted-foreground',
      )}
    >
      {status.toUpperCase()}
    </span>
  )
}
