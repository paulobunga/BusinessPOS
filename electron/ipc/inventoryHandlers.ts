import { ipcMain } from 'electron'
import { inventoryRepo } from '../db/repositories/inventoryRepo'

export function registerInventoryHandlers() {
  ipcMain.handle('inventory:recordPurchase', (_e, payload: { protein_id: number; quantity: number; cost_cents: number; date: string; created_by: number | null }) => {
    return inventoryRepo.recordPurchase(payload.protein_id, payload.quantity, payload.cost_cents, payload.date, payload.created_by)
  })

  ipcMain.handle('inventory:byDate', (_e, date: string) => {
    return inventoryRepo.getByDate(date)
  })

  ipcMain.handle('inventory:byDateRange', (_e, start: string, end: string) => {
    return inventoryRepo.getByDateRange(start, end)
  })

  ipcMain.handle('inventory:dailyTotal', (_e, date: string) => {
    return inventoryRepo.dailyTotal(date)
  })
}
