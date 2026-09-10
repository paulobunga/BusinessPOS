import { getDb } from '../index.js'

export const settingsRepo = {
  get(key: string): string | null {
    const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
    return row?.value ?? null
  },
  getAll(): Record<string, string> {
    const rows = getDb().prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
    return Object.fromEntries(rows.map(r => [r.key, r.value]))
  },
  set(key: string, value: string) {
    getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
  },
  setMany(entries: Record<string, string>) {
    const insert = getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    const tx = getDb().transaction(() => {
      for (const [k, v] of Object.entries(entries)) insert.run(k, v)
    })
    tx()
  },
  seed() {
    const count = getDb().prepare('SELECT COUNT(*) as c FROM settings').get() as { c: number }
    if (count.c === 0) {
      this.setMany({
        currency: 'UGX',
        tax_enabled: 'false',
        tax_rate: '0',
      })
    }
  }
}