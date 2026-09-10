import { ipcMain } from 'electron'
import { expensesRepo } from '../db/repositories/expensesRepo'

export function registerExpensesHandlers() {
  ipcMain.handle('expenses:create', (_e, payload) => {
    const id = expensesRepo.create(payload)
    return expensesRepo.getById(id)
  })

  ipcMain.handle('expenses:update', (_e, id: number, payload) => {
    return expensesRepo.update(id, payload)
  })

  ipcMain.handle('expenses:delete', (_e, id: number) => {
    expensesRepo.delete(id, 1)
  })

  ipcMain.handle('expenses:list', (_e, filters?) => {
    return expensesRepo.list(filters)
  })
}
