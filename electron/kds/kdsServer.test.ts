import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest'

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
import { usersRepo } from '../db/repositories/usersRepo'
import { ensureKdsToken } from './kdsConfig'
import { startKdsServer, stopKdsServer, getKdsStatus, emitToKitchenSocket } from './kdsServer'
import { io, type Socket } from 'socket.io-client'
import { createServer } from 'node:http'

function waitFor<T>(socket: Socket, event: string, timeoutMs = 5000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler)
      reject(new Error(`timed out waiting for ${event}`))
    }, timeoutMs)
    const handler = (payload: T) => {
      clearTimeout(timer)
      socket.off(event, handler)
      resolve(payload)
    }
    socket.on(event, handler)
  })
}

describe('kdsServer', () => {
  let saleId: number
  let port: number
  let token: string

  beforeAll(async () => {
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
    const userId = (usersRepo.create('KDS Server Test', 'admin', '9998') as any).id as number
    saleId = salesRepo.create({
      subtotal_cents: 1500,
      discount_cents: 0,
      total_cents: 1500,
      debt_cents: 0,
      payment_method: 'cash',
      created_by: userId,
      items: [],
    }) as number
    token = ensureKdsToken()
    const status = await startKdsServer(0)
    port = status.port as number
    expect(status.running).toBe(true)
    expect(port).toBeGreaterThan(0)
  }, 30000)

  afterAll(async () => {
    await stopKdsServer()
    db.close()
  })

  test('HTTP /kitchen is 503 pre-Task-3 (or 200 if public dir exists)', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/kitchen`)
    expect([200, 503]).toContain(res.status)
    if (res.status === 503) {
      expect(await res.text()).toBe('Kitchen display not installed')
    }
  })

  test('sync array contains the sale and kds:config has alertMinutes 10', async () => {
    const socket = io(`http://127.0.0.1:${port}/kitchen`, {
      auth: { token },
      reconnection: false,
    })
    try {
      const [sync, config] = await Promise.all([
        waitFor<any[]>(socket, 'orders:sync'),
        waitFor<{ alertMinutes: number }>(socket, 'kds:config'),
      ])
      expect(Array.isArray(sync)).toBe(true)
      expect(sync.map((o: any) => o.id)).toContain(saleId)
      expect(config.alertMinutes).toBe(10)
    } finally {
      socket.disconnect()
    }
  })

  test('wrong token yields connect_error', async () => {
    const bad = io(`http://127.0.0.1:${port}/kitchen`, {
      auth: { token: 'wrong-token' },
      reconnection: false,
    })
    try {
      const err = await waitFor<Error>(bad, 'connect_error')
      expect(String((err as any)?.message ?? err)).toMatch(/unauthorized/i)
    } finally {
      bad.disconnect()
    }
  })

  test("order:setStatus {orderId, status:'preparing'} emits order:updated and updates DB", async () => {
    const socket = io(`http://127.0.0.1:${port}/kitchen`, {
      auth: { token },
      reconnection: false,
    })
    try {
      await waitFor<any[]>(socket, 'orders:sync')
      const updatedPromise = waitFor<any>(socket, 'order:updated')
      socket.emit('order:setStatus', { orderId: saleId, status: 'preparing' })
      const updated = await updatedPromise
      expect(updated.kitchen_status).toBe('preparing')
      const row = db.prepare('SELECT kitchen_status FROM sales WHERE id = ?').get(saleId) as { kitchen_status: string }
      expect(row.kitchen_status).toBe('preparing')
    } finally {
      socket.disconnect()
    }
  })

  test("{status:'foo'} yields order:error and status unchanged", async () => {
    const socket = io(`http://127.0.0.1:${port}/kitchen`, {
      auth: { token },
      reconnection: false,
    })
    try {
      await waitFor<any[]>(socket, 'orders:sync')
      const errPromise = waitFor<{ message: string }>(socket, 'order:error')
      socket.emit('order:setStatus', { orderId: saleId, status: 'foo' })
      const err = await errPromise
      expect(err.message).toMatch(/Invalid request/)
      const row = db.prepare('SELECT kitchen_status FROM sales WHERE id = ?').get(saleId) as { kitchen_status: string }
      expect(row.kitchen_status).toBe('preparing')
    } finally {
      socket.disconnect()
    }
  })

  test('{orderId:99999} yields order:error', async () => {
    const socket = io(`http://127.0.0.1:${port}/kitchen`, {
      auth: { token },
      reconnection: false,
    })
    try {
      await waitFor<any[]>(socket, 'orders:sync')
      const errPromise = waitFor<{ message: string }>(socket, 'order:error')
      socket.emit('order:setStatus', { orderId: 99999, status: 'preparing' })
      const err = await errPromise
      expect(typeof err.message).toBe('string')
      expect(err.message.length).toBeGreaterThan(0)
    } finally {
      socket.disconnect()
    }
  })

  test('start on same port is a no-op returning current status', async () => {
    const current = getKdsStatus()
    expect(current.running).toBe(true)
    const again = await startKdsServer(current.port as number)
    expect(again.running).toBe(true)
    expect(again.port).toBe(current.port)
  })

  test('emitToKitchenSocket never throws when stopped', async () => {
    await stopKdsServer()
    expect(() => emitToKitchenSocket('order:updated', { id: saleId } as any)).not.toThrow()
    const restored = await startKdsServer(0)
    port = restored.port as number
    token = ensureKdsToken()
    expect(restored.running).toBe(true)
  })

  test('EADDRINUSE resolves to running:false with guidance (last)', async () => {
    await stopKdsServer()
    const dummy = createServer()
    await new Promise<void>((resolve) => dummy.listen(0, '0.0.0.0', () => resolve()))
    const addr = dummy.address() as { port: number }
    const busyPort = addr.port
    try {
      const status = await startKdsServer(busyPort)
      expect(status.running).toBe(false)
      expect(status.error).toMatch(/already in use/)
      expect(status.error).toMatch(/Settings/)
    } finally {
      await new Promise<void>((resolve) => dummy.close(() => resolve()))
    }
  }, 30000)
})
