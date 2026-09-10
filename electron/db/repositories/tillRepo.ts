import { getDb } from '../index'

export const tillRepo = {
  current(): { id: number; opened_at: string; opening_float_cents: number } | null {
    const row = getDb().prepare('SELECT id, opened_at, opening_float_cents FROM till_sessions WHERE closed_at IS NULL ORDER BY opened_at DESC LIMIT 1').get() as any
    return row ?? null
  },
  open(openingFloatCents: number) {
    const result = getDb().prepare('INSERT INTO till_sessions (opening_float_cents) VALUES (?)').run(openingFloatCents)
    return result.lastInsertRowid
  },
  close(id: number, closingBalanceCents: number) {
    getDb().prepare('UPDATE till_sessions SET closed_at = CURRENT_TIMESTAMP, counted_cash_cents = ? WHERE id = ?').run(closingBalanceCents, id)
  }
}