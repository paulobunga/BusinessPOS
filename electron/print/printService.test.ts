// electron/print/printService.test.ts
import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'

vi.mock('electron', () => ({ BrowserWindow: { getAllWindows: () => [] } }))

import Database from 'better-sqlite3'
import { runMigrations } from '../db/migrations/001_initial'
import { runSalesExtrasMigration } from '../db/migrations/002_sales_extras'
import { runExpensesMigration } from '../db/migrations/003_expenses_add_date_mpesa'
import { runDebtsMigration } from '../db/migrations/004_debts_payment_allocations'
import { runReimbursementsMigration } from '../db/migrations/005_reimbursements_add_columns'
import { runWasteMigration } from '../db/migrations/006_waste_table'
import { runCategoriesMigration } from '../db/migrations/007_categories'
import { runMoneyWholeUgxMigration } from '../db/migrations/008_money_whole_ugx'
import { runMenuSeedMigration } from '../db/migrations/009_menu_seed'
import { runPurchaseYieldMigration } from '../db/migrations/010_purchase_yield'
import { runPurchaseYieldsMigration } from '../db/migrations/011_purchase_yields'
import { runSetupMigration } from '../db/migrations/012_setup'
import { runUserRolesMigration } from '../db/migrations/013_user_roles'
import { runRemovePaymentIdMigration } from '../db/migrations/014_debt_allocations_cleanup'
import { runDebtWriteOffsMigration } from '../db/migrations/017_debt_write_offs'
import { runTotalYieldMigration } from '../db/migrations/022_total_yield'
import { runItemStockMovementsMigration } from '../db/migrations/024_item_stock_movements'
import { runYieldCleanupMigration } from '../db/migrations/025_yield_cleanup'
import { runPerLineCaptainMigration } from '../db/migrations/026_per_line_captain'
import { runYieldQtyPerSaleMigration } from '../db/migrations/027_yield_qty_per_sale'
import { runItemPurchaseNotesMigration } from '../db/migrations/028_item_purchase_notes'
import { runKitchenStatusMigration } from '../db/migrations/029_kitchen_status'

let db: Database.Database

vi.mock('../db/index', () => ({
  getDb: () => db,
}))

import { salesRepo } from '../db/repositories/salesRepo'
import { settingsRepo } from '../db/repositories/settingsRepo'
import { usersRepo } from '../db/repositories/usersRepo'
import { createPrintService } from './printService'

describe('printService', () => {
  let saleId: number

  beforeAll(() => {
    db = new Database(':memory:')
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
    runTotalYieldMigration(db)
    runItemStockMovementsMigration(db)
    runYieldCleanupMigration(db)
    runPerLineCaptainMigration(db)
    runYieldQtyPerSaleMigration(db)
    runItemPurchaseNotesMigration(db)
    runRemovePaymentIdMigration(db)
    runUserRolesMigration(db)
    runDebtWriteOffsMigration(db)
    runKitchenStatusMigration(db)
    const userId = (usersRepo.create('Print Test', 'cashier', '9997') as any).id as number
    saleId = salesRepo.create({
      subtotal_cents: 1500,
      discount_cents: 0,
      total_cents: 1500,
      debt_cents: 0,
      payment_method: 'cash',
      created_by: userId,
      items: [],
    }) as number
  })

  afterAll(() => {
    db.close()
  })

  beforeEach(() => {
    // normalize print settings: enabled, kot auto on (default), receipt auto off (default)
    db.prepare("DELETE FROM settings WHERE key LIKE 'print%'").run()
  })

  function fakeDriver() {
    const calls: string[] = []
    return {
      calls,
      driver: {
        listPrinters: async () => [],
        print: async (html: string) => {
          calls.push(html)
        },
      },
    }
  }

  test('invalid order id returns ok:false without printing', async () => {
    const { calls, driver } = fakeDriver()
    const svc = createPrintService(driver)
    const res = await svc.printTicket(1.5, 'kot')
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/Invalid order id/)
    expect(calls).toHaveLength(0)
  })

  test('unknown order id returns ok:false without printing', async () => {
    const { calls, driver } = fakeDriver()
    const svc = createPrintService(driver)
    const res = await svc.printTicket(99999, 'receipt')
    expect(res.ok).toBe(false)
    expect(typeof res.error).toBe('string')
    expect(calls).toHaveLength(0)
  })

  test('invalid print kind returns ok:false without printing', async () => {
    const { calls, driver } = fakeDriver()
    const svc = createPrintService(driver)
    const res = await svc.printTicket(saleId, 'foo' as any)
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/Invalid print kind/)
    expect(calls).toHaveLength(0)
  })

  test('print_enabled=false returns skipped without printing', async () => {
    const { calls, driver } = fakeDriver()
    const svc = createPrintService(driver)
    settingsRepo.set('print_enabled', 'false')
    const res = await svc.printTicket(saleId, 'kot')
    expect(res.ok).toBe(false)
    expect(res.skipped).toBe('printing disabled')
    expect(calls).toHaveLength(0)
  })

  test('valid printTicket resolves ok:true with html containing #<id>', async () => {
    const { calls, driver } = fakeDriver()
    const svc = createPrintService(driver)
    const res = await svc.printTicket(saleId, 'receipt')
    expect(res).toEqual({ ok: true })
    expect(calls).toHaveLength(1)
    expect(calls[0]).toContain(`#${saleId}`)
  })

  test('two concurrent printTicket calls execute in call order (serialized queue)', async () => {
    const started: string[] = []
    let releaseFirst!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const driver = {
      listPrinters: async () => [],
      print: async (html: string) => {
        started.push(html)
        if (started.length === 1) await gate
      },
    }
    const svc = createPrintService(driver)
    const p1 = svc.printTicket(saleId, 'receipt')
    const p2 = svc.printTicket(saleId, 'kot')
    // let the first job start; the second must wait behind the gate
    await new Promise((r) => setTimeout(r, 20))
    expect(started).toHaveLength(1)
    releaseFirst()
    const [r1, r2] = await Promise.all([p1, p2])
    expect(r1).toEqual({ ok: true })
    expect(r2).toEqual({ ok: true })
    expect(started).toHaveLength(2)
    // call order preserved: receipt first, kot second
    expect(started[0]).not.toContain('KITCHEN')
    expect(started[1]).toContain('KITCHEN')
  })

  test('maybeAutoPrint defaults print exactly one kot', async () => {
    const { calls, driver } = fakeDriver()
    const svc = createPrintService(driver)
    const order = salesRepo.getWithItems(saleId) as any
    const res = await svc.maybeAutoPrint(order)
    expect(res).toEqual({ ok: true })
    expect(calls).toHaveLength(1)
    expect(calls[0]).toContain('KITCHEN')
  })

  test('maybeAutoPrint with both auto flags off returns skipped', async () => {
    const { calls, driver } = fakeDriver()
    const svc = createPrintService(driver)
    settingsRepo.set('print_kot_auto', 'false')
    const order = salesRepo.getWithItems(saleId) as any
    const res = await svc.maybeAutoPrint(order)
    expect(res.ok).toBe(false)
    expect(res.skipped).toBe('auto-print off')
    expect(calls).toHaveLength(0)
  })

  test('printTest prints a demo receipt without throwing', async () => {
    const { calls, driver } = fakeDriver()
    const svc = createPrintService(driver)
    const res = await svc.printTest()
    expect(res).toEqual({ ok: true })
    expect(calls).toHaveLength(1)
  })
})
