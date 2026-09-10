import { ipcMain } from 'electron'
import { wasteRepo } from '../db/repositories/wasteRepo'

export function registerWasteHandlers() {
  ipcMain.handle('waste:record', (_e, payload: { protein_id: number; quantity: number; estimated_value_cents: number; reason: string; waste_date: string; notes?: string }) => {
    return wasteRepo.record(payload)
  })

  ipcMain.handle('waste:byDate', (_e, date: string) => {
    return wasteRepo.getByDate(date)
  })

  ipcMain.handle('waste:byDateRange', (_e, start: string, end: string) => {
    return wasteRepo.getByDateRange(start, end)
  })

  ipcMain.handle('waste:byProtein', (_e, start: string, end: string) => {
    return wasteRepo.getAggregatedByProtein(start, end)
  })

  ipcMain.handle('waste:dailyTotal', (_e, date: string) => {
    return wasteRepo.dailyTotal(date)
  })
}
