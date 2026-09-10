import { ipcMain } from 'electron'
import { usersRepo } from '../db/repositories/usersRepo.js'

export function registerAuthHandlers() {
  ipcMain.handle('auth:login', (_event, pin: string) => {
    const user = usersRepo.findByPin(pin) as any
    if (!user) return null
    return { userId: user.id, role: user.role }
  })
}