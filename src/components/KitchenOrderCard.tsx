import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from './ui/button'
import type { KitchenOrder, KitchenStatus } from '../../shared/kitchen'
import { KitchenBadge } from './KitchenBadge'

const NEXT_LABEL: Record<KitchenStatus, string | null> = {
  new: 'Start Preparing',
  preparing: 'Mark Completed',
  completed: 'Mark Served',
  served: null,
}

const NEXT_STATUS: Record<KitchenStatus, KitchenStatus | null> = {
  new: 'preparing',
  preparing: 'completed',
  completed: 'served',
  served: null,
}

function formatElapsed(createdAt: string, now: number): string {
  const created = new Date(createdAt).getTime()
  const diffMs = Number.isNaN(created) ? 0 : Math.max(0, now - created)
  const totalSeconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function KitchenOrderCard({
  order,
  overdue,
  onAdvance,
}: {
  order: KitchenOrder
  overdue: boolean
  onAdvance: (id: number, next: KitchenStatus) => void
}) {
  const [now, setNow] = useState(() => Date.now())
  const [printError, setPrintError] = useState<string | null>(null)
  const [printBusy, setPrintBusy] = useState(false)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const next = NEXT_STATUS[order.kitchen_status]
  const label = NEXT_LABEL[order.kitchen_status]

  const handlePrint = async () => {
    setPrintError(null)
    setPrintBusy(true)
    try {
      const res = await window.api['print:ticket']({ orderId: order.id, kind: 'kot' })
      if (!res.ok) setPrintError(res.error ?? res.skipped ?? 'Print failed')
    } catch (e: any) {
      setPrintError(e?.message ?? 'Print failed')
    }
    setPrintBusy(false)
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-[var(--radius-lg)] border border-border bg-card p-4',
        overdue && 'border-destructive/60 bg-destructive/10',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-lg font-bold">{`#${order.id}`}</span>
        <KitchenBadge status={order.kitchen_status} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.9375rem] font-bold">{order.customer_name ?? 'Walk-in'}</span>
        <span className={cn('text-[0.875rem] font-bold', overdue ? 'text-destructive' : 'text-muted-foreground')}>
          {formatElapsed(order.created_at, now)}
        </span>
      </div>
      {order.service_description ? <p className="m-0 text-[0.875rem] font-semibold">{order.service_description}</p> : null}
      <div className="flex flex-col gap-1">
        {order.items.map(item => (
          <div key={item.id} className="flex items-center gap-2 text-[0.9375rem]">
            <span className="font-bold">{`${item.quantity}×`}</span>
            <span className="font-semibold">{item.name_snapshot}</span>
          </div>
        ))}
      </div>
      {next && label ? (
        <Button
          type="button"
          className="mt-1 min-h-12 w-full min-w-12 text-[0.9375rem] font-bold"
          onClick={() => onAdvance(order.id, next)}
        >
          {label}
        </Button>
      ) : null}
      <Button
        type="button"
        variant="outline"
        className="mt-1 min-h-12 w-full min-w-12 border-border bg-card text-[0.9375rem] font-bold"
        disabled={printBusy}
        onClick={() => void handlePrint()}
      >
        {printBusy ? 'Printing...' : 'Print'}
      </Button>
      {printError && <p className="m-0 text-[0.8125rem] font-semibold text-destructive">{printError}</p>}
    </div>
  )
}
