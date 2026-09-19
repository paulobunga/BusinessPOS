import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '../../components/ui/button'
import { useKitchenOrders } from '../../hooks/useKitchenOrders'
import { KitchenOrderCard } from '../../components/KitchenOrderCard'
import { electronKitchenTransport } from '../../lib/kitchenTransport'
import type { KitchenStatus } from '../../../shared/kitchen'

const COLUMNS: { key: KitchenStatus; title: string }[] = [
  { key: 'new', title: 'New' },
  { key: 'preparing', title: 'Preparing' },
  { key: 'completed', title: 'Completed' },
]

function playBeep(audioRef: React.MutableRefObject<AudioContext | null>) {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    if (!audioRef.current) audioRef.current = new Ctor()
    const ctx = audioRef.current
    if (ctx.state === 'suspended') void ctx.resume()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    osc.start()
    osc.stop(ctx.currentTime + 0.25)
  } catch {
    // Audio is best-effort; kitchen display must keep working without sound.
  }
}

export function KitchenPage() {
  const { loading, error, byStatus, setStatus, alertMinutes } = useKitchenOrders()
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [advanceError, setAdvanceError] = useState<string | null>(null)
  const audioRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 10000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!soundEnabled) return
    return electronKitchenTransport.onEvent(e => {
      if (e.type === 'order:new') playBeep(audioRef)
    })
  }, [soundEnabled])

  const handleEnableSound = useCallback(() => {
    playBeep(audioRef)
    setSoundEnabled(true)
  }, [])

  const handleAdvance = useCallback(
    async (id: number, next: KitchenStatus) => {
      setAdvanceError(null)
      try {
        await setStatus(id, next)
      } catch (err) {
        setAdvanceError((err as Error).message || 'Failed to update order')
      }
    },
    [setStatus],
  )

  const isOverdue = useCallback(
    (createdAt: string) => {
      const created = new Date(createdAt).getTime()
      if (Number.isNaN(created)) return false
      return now - created > alertMinutes * 60_000
    },
    [now, alertMinutes],
  )

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Kitchen</h1>
        <div className="flex items-center gap-3">
          <span className={cn('text-[0.875rem] font-bold', error ? 'text-destructive' : 'text-success')}>
            {error ? error : 'Live'}
          </span>
          {!soundEnabled ? (
            <Button type="button" className="min-h-12 min-w-12 font-bold" onClick={handleEnableSound}>
              Enable sound
            </Button>
          ) : (
            <span className="text-[0.875rem] font-bold text-muted-foreground">Sound on</span>
          )}
        </div>
      </div>

      {advanceError ? <p className="m-0 font-semibold text-destructive">{advanceError}</p> : null}

      {loading ? (
        <p className="text-center text-muted-foreground">Loading...</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {COLUMNS.map(col => (
            <section key={col.key} aria-label={col.title} className="flex flex-col gap-3">
              <h2 className="text-lg font-bold">
                {col.title}
                <span className="ml-2 text-[0.875rem] font-bold text-muted-foreground">{byStatus[col.key].length}</span>
              </h2>
              {byStatus[col.key].length === 0 ? (
                <p className="rounded-[var(--radius-lg)] border border-border bg-card p-6 text-center text-muted-foreground">
                  No orders
                </p>
              ) : (
                byStatus[col.key].map(order => (
                  <KitchenOrderCard
                    key={order.id}
                    order={order}
                    overdue={isOverdue(order.created_at)}
                    onAdvance={handleAdvance}
                  />
                ))
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
