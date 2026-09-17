import { ipcMain } from 'electron'
import { purchasesRepo } from '../db/repositories/purchasesRepo'
import { expensesRepo } from '../db/repositories/expensesRepo'

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
}
