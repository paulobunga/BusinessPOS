import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'
import { runMigrations } from './migrations/001_initial.js'
import { runSalesExtrasMigration } from './migrations/002_sales_extras.js'
import { runExpensesMigration } from './migrations/003_expenses_add_date_mpesa.js'
import { runDebtsMigration } from './migrations/004_debts_payment_allocations.js'
import { runReimbursementsMigration } from './migrations/005_reimbursements_add_columns.js'
import { runWasteMigration } from './migrations/006_waste_table.js'
import { runCategoriesMigration } from './migrations/007_categories.js'
import { runMoneyWholeUgxMigration } from './migrations/008_money_whole_ugx.js'
import { runMenuSeedMigration } from './migrations/009_menu_seed.js'
import { runPurchaseYieldMigration } from './migrations/010_purchase_yield.js'
import { runPurchaseYieldsMigration } from './migrations/011_purchase_yields.js'
import { runUserRolesMigration } from './migrations/013_user_roles.js'
import { runAssetsMigration } from './migrations/015_assets.js'
import { runPinUniquenessMigration } from './migrations/016_pin_uniqueness.js'
import { runDebtWriteOffsMigration } from './migrations/017_debt_write_offs.js'
import { runInventoryV2Migration } from './migrations/018_inventory_v2.js'
import { runInventoryV2SeedMigration } from './migrations/019_inventory_v2_seed.js'
import { runChatTablesMigration } from './migrations/020_chat_tables.js'
import { runRemovePaymentIdMigration } from './migrations/014_debt_allocations_cleanup.js'
import { runSetupMigration } from './migrations/012_setup.js'
import { usersRepo } from './repositories/usersRepo.js'
import { settingsRepo } from './repositories/settingsRepo.js'
import { itemsRepo } from './repositories/itemsRepo.js'
import { categoriesRepo } from './repositories/categoriesRepo.js'

let db: Database.Database | null = null

const DATA_TABLES = [
  'item_purchase_yields',
  'item_yield_defaults',
  'item_purchases',
  'sale_items',
  'sales',
  'item_attribute_values',
  'attribute_defs',
  'menu_items',
  'categories',
  'waste',
  'assets',
  'cook_events',
  'payments',
  'payment_allocations',
  'debt_write_offs',
  'till_sessions',
  'customers',
  'reimbursements',
  'expenses',
  'users',
  'settings',
  'staff',
  'units',
  'ingredients',
  'suppliers',
  'market_purchases',
  'purchase_items',
  'stock_movements',
  'stock_counts',
]

function clearAllData(database: Database.Database) {
  const tables = DATA_TABLES.filter(t => database.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(t))
  database.pragma('foreign_keys = OFF')
  database.transaction(() => {
    for (const t of tables) database.prepare(`DELETE FROM ${t}`).run()
  })()
  database.pragma('foreign_keys = ON')
}

export function getDbPath(): string {
  return path.join(app.getPath('userData'), 'businesspos.sqlite')
}

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = getDbPath()
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
    runSalesExtrasMigration(db)
    runExpensesMigration(db)
    runDebtsMigration(db)
    runReimbursementsMigration(db)
    runWasteMigration(db)
    runCategoriesMigration(db)
    runMoneyWholeUgxMigration(db)
    runMenuSeedMigration(db)
    runPurchaseYieldMigration(db)
    runPurchaseYieldsMigration(db)
    runSetupMigration(db)
    runRemovePaymentIdMigration(db)
    runUserRolesMigration(db)
    runAssetsMigration(db)
    runPinUniquenessMigration(db)
    runDebtWriteOffsMigration(db)
    runInventoryV2Migration(db)
    runInventoryV2SeedMigration(db)
    runChatTablesMigration(db)

    const setupComplete = db.prepare("SELECT value FROM settings WHERE key = 'setup_complete'").get() as { value: string } | undefined
    const userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c

    if (userCount === 0 && !setupComplete) {
      clearAllData(db)
    } else {
      if (!setupComplete) settingsRepo.set('setup_complete', '1')
      usersRepo.seed()
      settingsRepo.seed()
      itemsRepo.seed()
      categoriesRepo.seedIfEmpty()
    }
  }
  return db
}

export function closeDb() {
  if (db) {
    db.close()
    db = null
  }
}
