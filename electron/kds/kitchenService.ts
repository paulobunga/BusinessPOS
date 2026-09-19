import { getDb } from '../db/index'
import { salesRepo } from '../db/repositories/salesRepo'
import { isKitchenStatus, isValidKitchenTransition, ACTIVE_KITCHEN_STATUSES, type KitchenOrder, type KitchenStatus } from '../../shared/kitchen'
export function listActiveKitchenOrders(): KitchenOrder[] {
  const db = getDb()
  const rows = db.prepare(`SELECT id FROM sales WHERE kitchen_status IN ('new','preparing','completed') AND status != 'voided' ORDER BY id ASC`).all() as { id: number }[]
  return rows.map(r => salesRepo.getWithItems(r.id) as unknown as KitchenOrder)
}
export function setKitchenStatus(id: number, to: unknown): KitchenOrder {
  if (!Number.isInteger(id)) throw new Error(`Invalid order id ${String(id)}`)
  if (!isKitchenStatus(to)) throw new Error(`Invalid status ${String(to)}`)
  const db = getDb()
  const row = db.prepare('SELECT id, kitchen_status FROM sales WHERE id = ?').get(id) as { id: number; kitchen_status: KitchenStatus } | undefined
  if (!row) throw new Error(`Order ${id} not found`)
  if (!isValidKitchenTransition(row.kitchen_status, to)) throw new Error(`Invalid transition ${row.kitchen_status} -> ${to}`)
  db.prepare('UPDATE sales SET kitchen_status = ? WHERE id = ?').run(to, id)
  return salesRepo.getWithItems(id) as unknown as KitchenOrder
}
export { ACTIVE_KITCHEN_STATUSES }
