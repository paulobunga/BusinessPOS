import { ipcMain } from 'electron'
import { categoriesRepo } from '../db/repositories/categoriesRepo'

export function registerCategoriesHandlers() {
  ipcMain.handle('categories:list', (_e, activeOnly?: boolean) => {
    return activeOnly ? categoriesRepo.listActive() : categoriesRepo.list()
  })

  ipcMain.handle('categories:upsert', (_e, payload) => categoriesRepo.upsert(payload))

  ipcMain.handle('categories:delete', (_e, id: number) => {
    categoriesRepo.del(id)
  })
}
