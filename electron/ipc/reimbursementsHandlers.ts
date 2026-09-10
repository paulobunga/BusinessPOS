import { ipcMain } from 'electron'
import { reimbursementsRepo } from '../db/repositories/reimbursementsRepo'

export function registerReimbursementsHandlers() {
  ipcMain.handle('reimbursements:create', (_e, payload) => {
    const id = reimbursementsRepo.create(payload)
    return reimbursementsRepo.getById(id)
  })

  ipcMain.handle('reimbursements:list', (_e, start: string, end: string) => {
    return reimbursementsRepo.listByDateRange(start, end)
  })

  ipcMain.handle('reimbursements:delete', (_e, id: number) => {
    reimbursementsRepo.delete(id)
  })
}
