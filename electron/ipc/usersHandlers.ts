import { ipcMain } from 'electron'
import { usersRepo } from '../db/repositories/usersRepo.js'
import type { Role } from '../../shared/types.js'

export function registerUsersHandlers() {
  ipcMain.handle('users:list', () => usersRepo.list())
  ipcMain.handle('users:create', (_e, p: { name: string; role: Role; pin: string }) => usersRepo.create(p.name, p.role, p.pin))
  ipcMain.handle('users:update', (_e, p: { id: number; name?: string; role?: Role; active?: number }) => usersRepo.update(p.id, p))
  ipcMain.handle('users:resetPin', (_e, p: { id: number; newPin: string }) => usersRepo.resetPin(p.id, p.newPin))
}