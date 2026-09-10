import { getDb } from '../index'

export const salesRepo = {
  create(data: {
    customer_name?: string
    subtotal_cents: number
    discount_cents: number
    discount_reason?: string
    total_cents: number
    debt_cents: number
    payment_method: 'cash' | 'debt' | 'mixed'
    till_session_id?: number | null
    created_by: number
    items: Array<{ item_id: number; free_item_id?: number | null; price_cents: number }>
  }) {
    const db = getDb()
    const status = data.payment_method === 'cash' ? 'completed' : 'unpaid'
    const paymentSource = data.payment_method === 'cash' ? 'cash' : 'unpaid'
    const customerId = resolveCustomer(data.customer_name)
    const result = db.prepare(`
      INSERT INTO sales (customer_id, customer_name, subtotal_cents, discount_cents, discount_reason, debt_cents, payment_method, status, payment_source, total_cents, till_session_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      customerId,
      data.customer_name ?? null,
      data.subtotal_cents,
      data.discount_cents,
      data.discount_reason ?? null,
      data.debt_cents,
      data.payment_method,
      status,
      paymentSource,
      data.total_cents,
      data.till_session_id ?? null,
      data.created_by
    )
    const saleId = result.lastInsertRowid as number
    const insertItem = db.prepare(`
      INSERT INTO sale_items (sale_id, item_id, free_item_id, name_snapshot, unit_price_cents, quantity, line_total_cents)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    const getItem = db.prepare('SELECT name FROM menu_items WHERE id = ?')
    for (const item of data.items) {
      const mi = getItem.get(item.item_id) as { name: string } | undefined
      insertItem.run(saleId, item.item_id, item.free_item_id ?? null, mi?.name ?? '', item.price_cents, 1, item.price_cents)
    }
    return saleId
  },
  listByDate(date: string) {
    return getDb().prepare('SELECT * FROM sales WHERE DATE(created_at) = ? ORDER BY created_at DESC').all(date)
  },
  getById(id: number) {
    return getDb().prepare('SELECT * FROM sales WHERE id = ?').get(id)
  }
}

function resolveCustomer(name?: string): number | null {
  if (!name || !name.trim()) return null
  const trimmed = name.trim()
  const existing = getDb().prepare('SELECT id FROM customers WHERE name = ?').get(trimmed) as { id: number } | undefined
  if (existing) return existing.id
  const result = getDb().prepare('INSERT OR IGNORE INTO customers (name) VALUES (?)').run(trimmed)
  return result.lastInsertRowid as number
}
