import { getDb } from '../index.js'
import { settingsRepo } from './settingsRepo.js'

const DATA_TABLES = [
  'item_yield_defaults',
  'item_purchases',
  'item_stock_movements',
  'sale_items',
  'sales',
  'item_attribute_values',
  'attribute_defs',
  'menu_items',
  'categories',
  'waste',
  'cook_events',
  'payments',
  'payment_allocations',
  'till_sessions',
  'customers',
  'reimbursements',
  'expenses',
  'users',
  'settings',
]

export const systemRepo = {
  needsSetup(): boolean {
    return settingsRepo.get('setup_complete') !== '1'
  },

  tableExists(name: string): boolean {
    const row = getDb()
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(name) as { name: string } | undefined
    return Boolean(row)
  },

  count(table: string): number {
    return (getDb().prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number }).c
  },

  clearAllData(): void {
    const db = getDb()
    const tables = DATA_TABLES.filter(t => this.tableExists(t))
    db.pragma('foreign_keys = OFF')
    db.transaction(() => {
      for (const t of tables) db.prepare(`DELETE FROM ${t}`).run()
    })()
    db.pragma('foreign_keys = ON')
  },

  purge(): void {
    this.clearAllData()
  },
}