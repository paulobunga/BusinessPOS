import { ipcMain, BrowserWindow } from 'electron'
import { listActiveKitchenOrders, setKitchenStatus } from '../kds/kitchenService'
import type { KitchenOrder } from '../../shared/kitchen'
export type KitchenEvent = { type: 'order:new' | 'order:updated'; order: KitchenOrder }
export function broadcastKitchenEvent(payload: KitchenEvent) {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('kitchen:event', payload)
}
export function registerKitchenHandlers() {
  ipcMain.handle('kitchen:list', () => listActiveKitchenOrders())
  ipcMain.handle('kitchen:setStatus', (_e, id: number, status: string) => {
    const updated = setKitchenStatus(id, status as any)
    broadcastKitchenEvent({ type: 'order:updated', order: updated })
    return updated
  })
}
