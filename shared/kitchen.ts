// shared/kitchen.ts
import type { SaleWithItems } from './types'
export type KitchenStatus = 'new' | 'preparing' | 'completed' | 'served'
export interface KitchenOrder extends SaleWithItems { kitchen_status: KitchenStatus }
export const ACTIVE_KITCHEN_STATUSES: KitchenStatus[] = ['new','preparing','completed']
const NEXT: Record<KitchenStatus, KitchenStatus | null> = { new:'preparing', preparing:'completed', completed:'served', served:null }
export function isValidKitchenTransition(from: KitchenStatus, to: KitchenStatus): boolean {
  if (from === to) return false
  const allowed: KitchenStatus[] = ['new','preparing','completed','served']
  if (!allowed.includes(from) || !allowed.includes(to)) return false
  return NEXT[from] === to
}
export function isKitchenStatus(v: unknown): v is KitchenStatus {
  return v==='new'||v==='preparing'||v==='completed'||v==='served'
}
