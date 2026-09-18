import { ipcMain } from 'electron'
import { wasteRepo } from '../db/repositories/wasteRepo'
import { stockRepo } from '../db/repositories/stockRepo'

export function registerWasteHandlers() {
  ipcMain.handle('waste:record', (_e, payload: { item_id: number; quantity: number; estimated_value_cents: number; reason: string; waste_date: string; notes?: string }) => {
    const record = wasteRepo.record(payload) as { id: number; item_id: number; quantity: number }
    try {
      stockRepo.recordMovement({
        item_id: record.item_id,
        movement_type: 'waste',
        quantity: Math.max(1, Math.round(record.quantity)),
        reference_table: 'waste',
        reference_id: record.id,
      })
    } catch {
      // stock movement failure should not block waste record
    }
    return record
  })

  ipcMain.handle('waste:byDate', (_e, date: string) => {
    return wasteRepo.getByDate(date)
  })

  ipcMain.handle('waste:byDateRange', (_e, start: string, end: string) => {
    return wasteRepo.getByDateRange(start, end)
  })

  ipcMain.handle('waste:byItem', (_e, start: string, end: string) => {
    return wasteRepo.getAggregatedByItem(start, end)
  })

  ipcMain.handle('waste:dailyTotal', (_e, date: string) => {
    return wasteRepo.dailyTotal(date)
  })
}
