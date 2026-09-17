import { ipcMain } from 'electron'
import { recipesRepo } from '../db/repositories/recipesRepo'

export function registerRecipesHandlers() {
  ipcMain.handle('recipes:list', () => {
    return recipesRepo.list()
  })

  ipcMain.handle('recipes:get', (_e, id: number) => {
    return recipesRepo.getById(id) ?? null
  })

  ipcMain.handle('recipes:create', (_e, payload: { name: string; description?: string; servings?: number; ingredients: Array<{ item_id: number | null; item_name: string; quantity: number; unit: string }> }) => {
    return recipesRepo.create(payload)
  })

  ipcMain.handle('recipes:update', (_e, id: number, payload: { name?: string; description?: string | null; servings?: number; active?: number; ingredients?: Array<{ id?: number; item_id: number | null; item_name: string; quantity: number; unit: string }> }) => {
    return recipesRepo.update(id, payload)
  })

  ipcMain.handle('recipes:delete', (_e, id: number) => {
    recipesRepo.del(id)
  })
}
