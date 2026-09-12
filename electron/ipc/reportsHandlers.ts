import { ipcMain } from 'electron'
import { reportsRepo } from '../db/repositories/reportsRepo'

export function registerReportsHandlers() {
  ipcMain.handle('reports:daily', (_e, start: string, end: string) => {
    return reportsRepo.getDaily(start, end)
  })

  ipcMain.handle('reports:monthly', (_e, year: number) => {
    return reportsRepo.getMonthly(year)
  })

  ipcMain.handle('reports:categoryBreakdown', (_e, start: string, end: string) => {
    return reportsRepo.getCategoryBreakdown(start, end)
  })

  ipcMain.handle('reports:itemPerformance', (_e, start: string, end: string) => {
    return reportsRepo.getItemPerformance(start, end)
  })

  ipcMain.handle('reports:debtSummary', () => {
    return reportsRepo.getDebtSummary()
  })

  ipcMain.handle('reports:sales', (_e, start: string, end: string) => {
    return reportsRepo.getSales(start, end)
  })

  ipcMain.handle('reports:tillSummary', (_e, tillSessionId: number) => {
    return reportsRepo.getTillSummary(tillSessionId)
  })
}
