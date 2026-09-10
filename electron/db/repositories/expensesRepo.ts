import { getDb } from '../index'

export const expensesRepo = {
  create(data: {
    till_session_id?: number | null
    date: string
    category: string
    description?: string
    amount_cents: number
    payment_source: 'till' | 'personal' | 'mpesa'
    reference?: string
    created_by: number
  }) {
    const db = getDb()
    const result = db.prepare(`
      INSERT INTO expenses (till_session_id, date, category, description, amount_cents, payment_source, reference, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.till_session_id ?? null,
      data.date,
      data.category,
      data.description ?? null,
      data.amount_cents,
      data.payment_source,
      data.reference ?? null,
      data.created_by
    )
    return result.lastInsertRowid as number
  },

  update(id: number, data: {
    date?: string
    category?: string
    description?: string
    amount_cents?: number
    payment_source?: 'till' | 'personal' | 'mpesa'
    reference?: string
  }) {
    const db = getDb()
    const fields: string[] = []
    const values: (string | number)[] = []

    if (data.date !== undefined) { fields.push('date = ?'); values.push(data.date) }
    if (data.category !== undefined) { fields.push('category = ?'); values.push(data.category) }
    if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description) }
    if (data.amount_cents !== undefined) { fields.push('amount_cents = ?'); values.push(data.amount_cents) }
    if (data.payment_source !== undefined) { fields.push('payment_source = ?'); values.push(data.payment_source) }
    if (data.reference !== undefined) { fields.push('reference = ?'); values.push(data.reference) }

    if (fields.length === 0) return this.getById(id)

    values.push(id)
    db.prepare(`UPDATE expenses SET ${fields.join(', ')} WHERE id = ? AND deleted_at IS NULL`).run(...values)
    return this.getById(id)
  },

  delete(id: number, deletedBy: number) {
    getDb().prepare(`
      UPDATE expenses SET deleted_at = datetime('now'), deleted_by = ? WHERE id = ? AND deleted_at IS NULL
    `).run(deletedBy, id)
  },

  list(filters?: { date_from?: string; date_to?: string; category?: string; payment_source?: string }) {
    const db = getDb()
    let query = 'SELECT * FROM expenses WHERE deleted_at IS NULL'
    const params: string[] = []

    if (filters?.date_from) { query += ' AND date >= ?'; params.push(filters.date_from) }
    if (filters?.date_to) { query += ' AND date <= ?'; params.push(filters.date_to) }
    if (filters?.category) { query += ' AND category = ?'; params.push(filters.category) }
    if (filters?.payment_source) { query += ' AND payment_source = ?'; params.push(filters.payment_source) }

    query += ' ORDER BY date DESC, created_at DESC'
    return db.prepare(query).all(...params)
  },

  getById(id: number) {
    return getDb().prepare('SELECT * FROM expenses WHERE id = ? AND deleted_at IS NULL').get(id)
  },
}
