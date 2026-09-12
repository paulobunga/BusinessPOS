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
import { usersRepo } from './repositories/usersRepo.js'
import { settingsRepo } from './repositories/settingsRepo.js'
import { itemsRepo } from './repositories/itemsRepo.js'
import { categoriesRepo } from './repositories/categoriesRepo.js'

let db: Database.Database | null = null

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
    runUserRolesMigration(db)
    usersRepo.seed()
    settingsRepo.seed()
    itemsRepo.seed()
    categoriesRepo.seedIfEmpty()
  }
  return db
}

export function closeDb() {
  if (db) {
    db.close()
    db = null
  }
}
