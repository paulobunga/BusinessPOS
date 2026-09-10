import { getDb } from '../index'

export const wasteRepo = {
  record(data: { protein_id: number; quantity: number; estimated_value_cents: number; reason: string; waste_date: string; notes?: string }) {
    const result = getDb().prepare(
      'INSERT INTO waste (protein_id, quantity, estimated_value_cents, reason, waste_date, notes) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(data.protein_id, data.quantity, data.estimated_value_cents, data.reason, data.waste_date, data.notes ?? null)
    return getDb().prepare(`
      SELECT w.*, p.name as protein_name
      FROM waste w
      JOIN proteins p ON p.id = w.protein_id
      WHERE w.id = ?
    `).get(result.lastInsertRowid)
  },

  getByDate(date: string) {
    return getDb().prepare(`
      SELECT w.*, p.name as protein_name
      FROM waste w
      JOIN proteins p ON p.id = w.protein_id
      WHERE w.waste_date = ?
      ORDER BY w.id DESC
    `).all(date)
  },

  getByDateRange(start: string, end: string) {
    return getDb().prepare(`
      SELECT w.*, p.name as protein_name
      FROM waste w
      JOIN proteins p ON p.id = w.protein_id
      WHERE w.waste_date >= ? AND w.waste_date <= ?
      ORDER BY w.waste_date DESC, w.id DESC
    `).all(start, end)
  },

  getAggregatedByProtein(start: string, end: string) {
    return getDb().prepare(`
      SELECT p.name as protein_name, SUM(w.quantity) as total_quantity, SUM(w.estimated_value_cents) as total_value_cents
      FROM waste w
      JOIN proteins p ON p.id = w.protein_id
      WHERE w.waste_date >= ? AND w.waste_date <= ?
      GROUP BY w.protein_id
      ORDER BY total_value_cents DESC
    `).all(start, end)
  },

  dailyTotal(date: string) {
    const row = getDb().prepare(
      'SELECT COALESCE(SUM(estimated_value_cents), 0) as total FROM waste WHERE waste_date = ?'
    ).get(date) as { total: number }
    return row.total
  },
}
