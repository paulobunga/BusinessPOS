import { ipcMain } from 'electron'
import { assetsRepo } from '../db/repositories/assetsRepo'

export function registerAssetsHandlers() {
  ipcMain.handle('assets:list', () => assetsRepo.list())

  ipcMain.handle('assets:get', (_e, id: number) => assetsRepo.getById(id) ?? null)

  ipcMain.handle('assets:create', (_e, payload) => {
    const id = assetsRepo.create(payload)
    return assetsRepo.getById(id)!
  })

  ipcMain.handle('assets:update', (_e, id: number, payload) => {
    return assetsRepo.update(id, payload)
  })

  ipcMain.handle('assets:dispose', (_e, id: number, payload) => {
    return assetsRepo.dispose(id, payload.disposed_at, payload.reason, payload.proceeds_cents ?? null)
  })

  ipcMain.handle('assets:summary', () => assetsRepo.summary())
}