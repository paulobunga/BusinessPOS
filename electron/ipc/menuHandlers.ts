import { ipcMain } from 'electron'
import { proteinsRepo } from '../db/repositories/proteinsRepo'
import { starchesRepo } from '../db/repositories/starchesRepo'

export function registerMenuHandlers() {
  ipcMain.handle('proteins:list', () => proteinsRepo.list())
  ipcMain.handle('proteins:listAll', () => proteinsRepo.listAll())
  ipcMain.handle('proteins:upsert', (_e, payload) => proteinsRepo.upsert(payload))
  ipcMain.handle('proteins:setOutOfStock', (_e, id, outOfStock) => proteinsRepo.setOutOfStock(id, outOfStock))
  ipcMain.handle('starches:list', () => starchesRepo.list())
  ipcMain.handle('starches:listAll', () => starchesRepo.listAll())
  ipcMain.handle('starches:upsert', (_e, payload) => starchesRepo.upsert(payload))
  ipcMain.handle('starches:delete', (_e, id) => starchesRepo.delete(id))
}
