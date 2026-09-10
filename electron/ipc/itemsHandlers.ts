import { ipcMain } from 'electron'
import { itemsRepo } from '../db/repositories/itemsRepo'

export function registerItemsHandlers() {
  ipcMain.handle('items:list', (_e, filters?: { categoryId?: number; kind?: 'priced' | 'free'; activeOnly?: boolean }) => {
    if (!filters || (filters.categoryId == null && !filters.kind && !filters.activeOnly)) {
      return itemsRepo.listAll()
    }
    if (filters.activeOnly && filters.categoryId == null && !filters.kind) {
      return itemsRepo.listActive()
    }
    if (filters.categoryId != null) {
      return itemsRepo.listByCategory(filters.categoryId, filters.activeOnly)
    }
    if (filters.kind) {
      return itemsRepo.listByKind(filters.kind, filters.activeOnly)
    }
    return itemsRepo.listAll()
  })

  ipcMain.handle('items:upsert', (_e, payload) => itemsRepo.upsert(payload))

  ipcMain.handle('items:setOutOfStock', (_e, id: number, outOfStock: boolean) => {
    itemsRepo.setOutOfStock(id, outOfStock)
  })

  ipcMain.handle('items:delete', (_e, id: number) => {
    itemsRepo.del(id)
  })
}
