import { ipcMain } from 'electron'
import { debtsRepo } from '../db/repositories/debtsRepo.js'
import type { PayOnAccountPayload, WriteOffPayload } from '../../shared/types'

export function registerDebtsHandlers() {
  ipcMain.handle('debts:listOpen', () => debtsRepo.listOpen())
  ipcMain.handle('debts:recordPayment', (_e, payload: { sale_id: number; amount_cents: number; payment_method: string; till_session_id: number | null; created_by: number }) => {
    return debtsRepo.recordPayment(payload.sale_id, payload.amount_cents, payload.payment_method, payload.till_session_id, payload.created_by)
  })
  ipcMain.handle('debts:writeOff', (_e, payload: WriteOffPayload) => {
    return debtsRepo.writeOff(payload)
  })
  ipcMain.handle('debts:writeOffs', (_e, sale_id: number) => debtsRepo.writeOffs(sale_id))
  ipcMain.handle('debts:customerBalances', () => debtsRepo.customerBalances())
  ipcMain.handle('debts:customerDetail', (_e, customerName: string) => debtsRepo.customerDetail(customerName))
  ipcMain.handle('debts:balanceByName', (_e, customerName: string) => debtsRepo.balanceByName(customerName))
  ipcMain.handle('debts:payOnAccount', (_e, payload: PayOnAccountPayload) => debtsRepo.payOnAccount(payload))
  ipcMain.handle('debts:getTotalOwed', (_e, sale_id: number) => debtsRepo.getTotalOwed(sale_id))
  ipcMain.handle('debts:history', (_e, sale_id: number) => debtsRepo.history(sale_id))
  ipcMain.handle('debts:recordFromList', (_e, entries: Array<{
    customer_name: string
    date: string
    items: Array<{ name_snapshot: string; unit_price_cents: number; quantity: number }>
    paid_cents?: number
    created_by: number
  }>) => debtsRepo.recordFromList(entries))
}
