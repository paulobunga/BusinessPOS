import { ipcMain } from 'electron'
import { debtsRepo } from '../db/repositories/debtsRepo.js'

export function registerDebtsHandlers() {
  ipcMain.handle('debts:listOpen', () => {
    return debtsRepo.listOpen()
  })
  ipcMain.handle('debts:recordPayment', (_e, payload: { sale_id: number; amount_cents: number; payment_method: string; till_session_id: number | null; created_by: number }) => {
    debtsRepo.recordPayment(payload.sale_id, payload.amount_cents, payload.payment_method, payload.till_session_id, payload.created_by)
  })
  ipcMain.handle('debts:getTotalOwed', (_e, sale_id: number) => {
    return debtsRepo.getTotalOwed(sale_id)
  })
  ipcMain.handle('debts:history', (_e, sale_id: number) => {
    return debtsRepo.history(sale_id)
  })
}
