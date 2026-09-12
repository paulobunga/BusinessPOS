import { ipcMain } from 'electron'
import { usersRepo } from '../db/repositories/usersRepo.js'

export function registerAuthHandlers() {
  ipcMain.handle('auth:login', (_event, pin: string) => {
    const user = usersRepo.findByPin(pin) as { id: number; name: string; role: string; active: number } | undefined
    if (!user) return null
    return { userId: user.id, role: user.role, name: user.name }
  })
}