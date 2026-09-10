import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'
import { runMigrations } from './migrations/001_initial.js'
import { runSalesExtrasMigration } from './migrations/002_sales_extras.js'
import { runExpensesMigration } from './migrations/003_expenses_add_date_mpesa.js'
import { runDebtsMigration } from './migrations/004_debts_payment_allocations.js'
import { usersRepo } from './repositories/usersRepo.js'
import { settingsRepo } from './repositories/settingsRepo.js'
import { proteinsRepo } from './repositories/proteinsRepo.js'
import { starchesRepo } from './repositories/starchesRepo.js'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = path.join(app.getPath('userData'), 'businesspos.sqlite')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
    runSalesExtrasMigration(db)
    runExpensesMigration(db)
    runDebtsMigration(db)
    usersRepo.seed()
    settingsRepo.seed()
    proteinsRepo.seed()
    starchesRepo.seed()
  }
  return db
}

export function closeDb() {
  if (db) {
    db.close()
    db = null
  }
}
