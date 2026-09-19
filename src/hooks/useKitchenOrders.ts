import { useCallback, useEffect, useMemo, useState } from 'react'
import type { KitchenOrder, KitchenStatus } from '../../shared/kitchen'
import { ACTIVE_KITCHEN_STATUSES } from '../../shared/kitchen'
import { electronKitchenTransport } from '../lib/kitchenTransport'

const DEFAULT_ALERT_MINUTES = 10

function sortAsc(orders: KitchenOrder[]): KitchenOrder[] {
  return [...orders].sort((a, b) => a.id - b.id)
}

function isActive(order: KitchenOrder): boolean {
  return (ACTIVE_KITCHEN_STATUSES as KitchenStatus[]).includes(order.kitchen_status)
}

export function useKitchenOrders() {
  const [orders, setOrders] = useState<KitchenOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [alertMinutes, setAlertMinutes] = useState<number>(DEFAULT_ALERT_MINUTES)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [list, settings] = await Promise.all([
          electronKitchenTransport.list(),
          window.api['settings:get']().catch(() => ({} as Record<string, string>)),
        ])
        if (cancelled) return
        setOrders(sortAsc(list.filter(isActive)))
        const raw = settings?.kds_alert_minutes
        const parsed = raw != null ? parseInt(raw, 10) : NaN
        setAlertMinutes(Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_ALERT_MINUTES)
      } catch (err) {
        if (cancelled) return
        setError((err as Error).message || 'Failed to load kitchen orders')
        setOrders([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    const unsubscribe = electronKitchenTransport.onEvent(e => {
      if (cancelled) return
      if (e.type === 'order:new' || e.type === 'order:updated') {
        setOrders(prev => {
          const order = e.order
          if (!isActive(order)) return prev.filter(o => o.id !== order.id)
          const exists = prev.some(o => o.id === order.id)
          const next = exists ? prev.map(o => (o.id === order.id ? order : o)) : [...prev, order]
          return sortAsc(next)
        })
      }
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const setStatus = useCallback(async (id: number, s: KitchenStatus): Promise<void> => {
    try {
      const updated = await electronKitchenTransport.setStatus(id, s)
      setOrders(prev => {
        if (!isActive(updated)) return prev.filter(o => o.id !== updated.id)
        return sortAsc(prev.map(o => (o.id === updated.id ? updated : o)))
      })
    } catch (err) {
      const message = (err as Error).message || 'Failed to update order status'
      setError(message)
      throw new Error(message)
    }
  }, [])

  const byStatus = useMemo<Record<KitchenStatus, KitchenOrder[]>>(() => {
    const grouped: Record<KitchenStatus, KitchenOrder[]> = {
      new: [],
      preparing: [],
      completed: [],
      served: [],
    }
    for (const order of orders) {
      grouped[order.kitchen_status]?.push(order)
    }
    return grouped
  }, [orders])

  return { orders, loading, error, byStatus, setStatus, alertMinutes }
}
