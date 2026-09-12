import { ipcMain } from 'electron'
import { purchasesRepo } from '../db/repositories/purchasesRepo'

export function registerInventoryHandlers() {
  ipcMain.handle('inventory:recordPurchase', (_e, payload: { item_id: number; quantity: number; cost_cents: number; date: string; created_by: number | null; unit?: string; yield_item_id?: number | null; expected_yield?: number; yields?: { itemId: number; portions: number }[] }) => {
    return purchasesRepo.recordPurchase(payload.item_id, payload.quantity, payload.cost_cents, payload.date, payload.created_by, {
      unit: payload.unit,
      yieldItemId: payload.yield_item_id ?? null,
      expectedYield: payload.expected_yield,
      yields: payload.yields,
    })
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
