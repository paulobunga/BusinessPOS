import { ipcMain } from 'electron'
import { attributesRepo } from '../db/repositories/attributesRepo'

export function registerAttributesHandlers() {
  ipcMain.handle('attributes:list', (_e, filters?: { categoryId?: number | null }) => {
    return attributesRepo.list(filters?.categoryId)
  })

  ipcMain.handle('attributes:upsert', (_e, payload) => attributesRepo.upsert(payload))

  ipcMain.handle('attributes:delete', (_e, id: number) => {
    attributesRepo.del(id)
  })

  ipcMain.handle('attributes:saveValues', (_e, payload: { itemId: number; values: Array<{ attr_def_id: number; value_text?: string; value_number?: number; value_boolean?: boolean }> }) => {
    attributesRepo.saveValues(payload.itemId, payload.values)
  })
}
