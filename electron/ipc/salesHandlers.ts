import { ipcMain } from 'electron'
import { salesRepo } from '../db/repositories/salesRepo'
import { tillRepo } from '../db/repositories/tillRepo'

export function registerSalesHandlers() {
  ipcMain.handle('sales:create', (_e, payload) => {
    const id = salesRepo.create(payload)
    return salesRepo.getById(id)
  })
  ipcMain.handle('sales:listByDate', (_e, date) => {
    return salesRepo.listByDate(date)
  })
  ipcMain.handle('sales:getById', (_e, id) => {
    return salesRepo.getById(id)
  })
  ipcMain.handle('till:current', () => {
    return tillRepo.current()
  })
}