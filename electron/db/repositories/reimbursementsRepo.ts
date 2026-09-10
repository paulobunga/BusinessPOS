import { getDb } from '../index'

export const reimbursementsRepo = {
  create(data: { description: string; amount_cents: number; till_session_id?: number | null; created_by: number; date: string; paid_to: 'till' | 'mpesa' }) {
    const result = getDb().prepare(`
      INSERT INTO reimbursements (description, amount_cents, till_session_id, created_by, date, paid_to)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(data.description, data.amount_cents, data.till_session_id ?? null, data.created_by, data.date, data.paid_to)
    return result.lastInsertRowid as number
  },

  getById(id: number) {
    return getDb().prepare('SELECT * FROM reimbursements WHERE id = ?').get(id)
  },

  listByDateRange(start: string, end: string) {
    return getDb().prepare('SELECT * FROM reimbursements WHERE date BETWEEN ? AND ? ORDER BY date DESC, created_at DESC').all(start, end)
  },

  delete(id: number) {
    getDb().prepare('DELETE FROM reimbursements WHERE id = ?').run(id)
  }
}
