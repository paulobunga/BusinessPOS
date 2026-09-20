import { ipcMain } from 'electron'
import { printService } from '../print/printService'
import type { PrintKind } from '../../shared/print'
export function registerPrintHandlers() {
  ipcMain.handle('print:listPrinters', async () => {
    try { return await printService.listPrinters() } catch { return [] }
  })
  ipcMain.handle('print:test', async (_e, kind?: PrintKind) => {
    try { return await printService.printTest(kind === 'kot' ? 'kot' : 'receipt') } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'Print failed' } }
  })
  ipcMain.handle('print:ticket', async (_e, req: { orderId: number; kind: PrintKind }) => {
    try { return await printService.printTicket(req?.orderId, req?.kind) } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'Print failed' } }
  })
}
