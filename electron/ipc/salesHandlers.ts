import { ipcMain } from 'electron'
import { salesRepo } from '../db/repositories/salesRepo'
import { tillRepo } from '../db/repositories/tillRepo'

export function registerSalesHandlers() {
  ipcMain.handle('sales:create', (_e, payload) => {
    const id = salesRepo.create(payload)
    return salesRepo.getById(id)
  })
  ipcMain.handle('sales:createCaptainOrder', (_e, payload) => {
    const id = salesRepo.createCaptainOrder(payload)
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
  ipcMain.handle('till:open', (_e, floatCents: number) => {
    const id = tillRepo.open(floatCents)
    return tillRepo.current()
  })
  ipcMain.handle('till:close', (_e, countedCents: number) => {
    const current = tillRepo.current()
    if (!current) throw new Error('No open till session')
    const countData = tillRepo.countCash()
    const expected = countData?.expectedClosingCents ?? current.opening_float_cents
    tillRepo.close(current.id, countedCents)
    return { expected, variance: countedCents - expected }
  })
  ipcMain.handle('till:countCash', () => {
    return tillRepo.countCash()
  })
}