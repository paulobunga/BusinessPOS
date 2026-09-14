import { ipcMain } from 'electron'
import { debtsRepo } from '../db/repositories/debtsRepo.js'
import type { PayOnAccountPayload } from '../../shared/types'

export function registerDebtsHandlers() {
  ipcMain.handle('debts:listOpen', () => debtsRepo.listOpen())
  ipcMain.handle('debts:recordPayment', (_e, payload: { sale_id: number; amount_cents: number; payment_method: string; till_session_id: number | null; created_by: number }) => {
    return debtsRepo.recordPayment(payload.sale_id, payload.amount_cents, payload.payment_method, payload.till_session_id, payload.created_by)
  })
  ipcMain.handle('debts:customerBalances', () => debtsRepo.customerBalances())
  ipcMain.handle('debts:customerDetail', (_e, customerName: string) => debtsRepo.customerDetail(customerName))
  ipcMain.handle('debts:balanceByName', (_e, customerName: string) => debtsRepo.balanceByName(customerName))
  ipcMain.handle('debts:payOnAccount', (_e, payload: PayOnAccountPayload) => debtsRepo.payOnAccount(payload))
  ipcMain.handle('debts:getTotalOwed', (_e, sale_id: number) => debtsRepo.getTotalOwed(sale_id))
  ipcMain.handle('debts:history', (_e, sale_id: number) => debtsRepo.history(sale_id))
}