import { ipcMain } from 'electron'
import { purchasesRepo } from '../db/repositories/purchasesRepo'
import { expensesRepo } from '../db/repositories/expensesRepo'
import { stockRepo } from '../db/repositories/stockRepo'

export function registerInventoryHandlers() {
  ipcMain.handle('inventory:recordPurchase', (_e, payload: { item_id: number; quantity: number; cost_cents: number; date: string; created_by: number | null; unit?: string; total_yield: number }) => {
    const purchase = purchasesRepo.recordPurchase(payload.item_id, payload.quantity, payload.cost_cents, payload.date, payload.created_by, payload.total_yield, {
      unit: payload.unit,
    })
    try {
      const expenseData: { category: string; description: string; amount_cents: number; payment_source: 'till' | 'personal' | 'mpesa'; date: string; created_by: number } = {
        category: 'Supplies',
        description: `${purchase.item_name ?? 'Purchase'} × ${payload.quantity} ${payload.unit ?? 'kg'}`,
        amount_cents: payload.cost_cents,
        payment_source: 'till',
        date: payload.date,
        created_by: payload.created_by ?? 1,
      }
      expensesRepo.create(expenseData)
    } catch {
      // expense failure should not block purchase
    }
    try {
      stockRepo.recordMovement({
        item_id: payload.item_id,
        movement_type: 'purchase_in',
        quantity: payload.total_yield,
        reference_table: 'item_purchases',
        reference_id: purchase.id,
        created_by: payload.created_by ?? 1,
      })
    } catch {
      // stock movement failure should not block purchase
    }
    return purchase
  })

  ipcMain.handle('inventory:byDate', (_e, date: string) => {
    return purchasesRepo.getByDate(date)
  })

  ipcMain.handle('inventory:byDateRange', (_e, start: string, end: string) => {
    return purchasesRepo.getByDateRange(start, end)
  })

  ipcMain.handle('inventory:dailyTotal', (_e, date: string) => {
    return purchasesRepo.dailyTotal(date)
  })

  ipcMain.handle('inventory:recordMovement', (_e, payload: { item_id: number; movement_type: 'purchase_in' | 'sale_out' | 'discount_out' | 'captain_out' | 'waste'; quantity: number; is_discount?: number; reference_table?: string; reference_id?: number; created_by?: number | null; notes?: string }) => {
    return stockRepo.recordMovement(payload)
  })

  ipcMain.handle('inventory:stockBalance', (_e, itemId: number) => {
    return stockRepo.getBalance(itemId)
  })

  ipcMain.handle('inventory:stockMovements', (_e, itemId: number, limit?: number) => {
    return stockRepo.getMovements(itemId, limit)
  })

  ipcMain.handle('inventory:stockAvailability', (_e, itemIds: number[]) => {
    return stockRepo.getAvailabilityMany(itemIds)
  })
}
