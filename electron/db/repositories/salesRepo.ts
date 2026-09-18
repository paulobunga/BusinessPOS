import { getDb } from '../index'
import { stockRepo } from './stockRepo'
import type { SaleWithItems, SaleItem } from '../../../shared/types'

const SALE_COLUMNS = `
  id, till_session_id, created_at, status, subtotal_cents, discount_cents,
  tax_cents, total_cents, payment_source, customer_id, customer_name,
  created_by, voided_at, voided_by, void_reason, discount_reason,
  debt_cents, payment_method, sale_kind, service_description
`

function attachItems(sales: SaleWithItems[]): SaleWithItems[] {
  const db = getDb()
  const ids = sales.map(s => s.id)
  const itemRows: SaleItem[] = ids.length
    ? db.prepare(`
        SELECT id, sale_id, item_id, free_item_id, name_snapshot, unit_price_cents, quantity, line_total_cents, is_captain
        FROM sale_items
        WHERE sale_id IN (${ids.map(() => '?').join(',')})
        ORDER BY id ASC
      `).all(...ids) as SaleItem[]
    : []
  const bySale = new Map<number, SaleItem[]>()
  for (const it of itemRows) {
    const arr = bySale.get(it.sale_id) ?? []
    arr.push(it)
    bySale.set(it.sale_id, arr)
  }
  return sales.map(s => ({ ...s, items: bySale.get(s.id) ?? [] }))
}

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
    items: Array<{ item_id: number; free_item_id?: number | null; price_cents: number; quantity?: number; is_captain?: boolean }>
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
      INSERT INTO sale_items (sale_id, item_id, free_item_id, name_snapshot, unit_price_cents, quantity, line_total_cents, is_captain)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const getItem = db.prepare('SELECT name, selling_price_cents FROM menu_items WHERE id = ?')
    for (const item of data.items) {
      const mi = getItem.get(item.item_id) as { name: string; selling_price_cents: number } | undefined
      const qty = item.quantity ?? 1
      const isCaptain = item.is_captain ? 1 : 0
      const unitPrice = isCaptain ? (mi?.selling_price_cents ?? item.price_cents) : item.price_cents
      insertItem.run(saleId, item.item_id, item.free_item_id ?? null, mi?.name ?? '', unitPrice, qty, isCaptain ? 0 : unitPrice * qty, isCaptain)
      stockRepo.consumeForSale(item.item_id, qty, {
        movement_type: isCaptain ? 'captain_out' : 'sale_out',
        is_discount: data.discount_cents > 0 ? 1 : 0,
        reference_table: 'sales',
        reference_id: saleId,
        created_by: data.created_by,
      })
    }
    return saleId
  },
  createCaptainOrder(data: {
    customer_name?: string
    service_description: string
    subtotal_cents: number
    discount_cents: number
    discount_reason?: string
    total_cents: number
    till_session_id?: number | null
    created_by: number
    items: Array<{ item_id: number; free_item_id?: number | null; price_cents: number; quantity?: number }>
  }): number {
    if (!data.service_description || !data.service_description.trim()) {
      throw new Error('A service description is required for a Captain Order')
    }
    const db = getDb()
    return db.transaction(() => {
      const customerId = resolveCustomer(data.customer_name)
      const result = db.prepare(`
        INSERT INTO sales (customer_id, customer_name, subtotal_cents, discount_cents, discount_reason, debt_cents, payment_method, status, payment_source, total_cents, till_session_id, created_by, sale_kind, service_description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        customerId,
        data.customer_name ?? null,
        data.subtotal_cents,
        data.discount_cents,
        data.discount_reason ?? null,
        data.total_cents,
        'debt',
        'unpaid',
        'unpaid',
        data.total_cents,
        data.till_session_id ?? null,
        data.created_by,
        'captain',
        data.service_description.trim()
      )
      const saleId = result.lastInsertRowid as number

      const insertItem = db.prepare(`
        INSERT INTO sale_items (sale_id, item_id, free_item_id, name_snapshot, unit_price_cents, quantity, line_total_cents)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      const getItem = db.prepare('SELECT name FROM menu_items WHERE id = ?')
      for (const item of data.items) {
        const mi = getItem.get(item.item_id) as { name: string } | undefined
        const qty = item.quantity ?? 1
        insertItem.run(saleId, item.item_id, item.free_item_id ?? null, mi?.name ?? '', item.price_cents, qty, item.price_cents * qty)
        stockRepo.consumeForSale(item.item_id, qty, {
          movement_type: 'captain_out',
          reference_table: 'sales',
          reference_id: saleId,
          created_by: data.created_by,
        })
      }

    db.prepare(`
      INSERT INTO payment_allocations (sale_id, amount_cents, payment_method, till_session_id, created_by, note)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(saleId, data.total_cents, 'service', null, data.created_by, data.service_description.trim())

    db.prepare("UPDATE sales SET status = 'completed' WHERE id = ?").run(saleId)
    return saleId
    })()
  },
  listByDate(date: string) {
    return getDb().prepare('SELECT * FROM sales WHERE DATE(created_at) = ? ORDER BY created_at DESC').all(date)
  },
  getById(id: number) {
    return getDb().prepare('SELECT * FROM sales WHERE id = ?').get(id)
  },
  list(filters?: { status?: string; date_from?: string; date_to?: string }): SaleWithItems[] {
    const db = getDb()
    const where: string[] = []
    const params: (string | number)[] = []
    if (filters?.status) { where.push('status = ?'); params.push(filters.status) }
    if (filters?.date_from) { where.push('DATE(created_at) >= ?'); params.push(filters.date_from) }
    if (filters?.date_to) { where.push('DATE(created_at) <= ?'); params.push(filters.date_to) }
    const rows = db.prepare(`
      SELECT ${SALE_COLUMNS}
      FROM sales
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY id DESC
    `).all(...params) as SaleWithItems[]
    return attachItems(rows)
  },
  getWithItems(id: number): SaleWithItems {
    const row = getDb().prepare(`SELECT ${SALE_COLUMNS} FROM sales WHERE id = ?`).get(id) as SaleWithItems | undefined
    if (!row) throw new Error(`Sale ${id} not found`)
    return attachItems([row])[0]
  },
  voidSale(id: number, reason: string): void {
    if (!reason || !reason.trim()) throw new Error('A void reason is required')
    const db = getDb()
    const sale = db.prepare('SELECT status FROM sales WHERE id = ?').get(id) as { status: string } | undefined
    if (!sale) throw new Error(`Sale ${id} not found`)
    if (sale.status === 'voided') throw new Error('Sale is already voided')
    // Stock is left untouched: voided items were already served, so no restock.
    // Reports and debt lists filter on completed/unpaid, so voided sales drop out automatically.
    db.prepare(`UPDATE sales SET status = 'voided', void_reason = ?, voided_at = datetime('now') WHERE id = ?`)
      .run(reason.trim(), id)
  },
}

function resolveCustomer(name?: string): number | null {
  if (!name || !name.trim()) return null
  const trimmed = name.trim()
  const existing = getDb().prepare('SELECT id FROM customers WHERE name = ?').get(trimmed) as { id: number } | undefined
  if (existing) return existing.id
  const result = getDb().prepare('INSERT OR IGNORE INTO customers (name) VALUES (?)').run(trimmed)
  return result.lastInsertRowid as number
}
