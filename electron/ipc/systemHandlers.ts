import { ipcMain } from 'electron'
import { systemRepo } from '../db/repositories/systemRepo.js'
import { setupRepo } from '../db/repositories/setupRepo.js'
import type { SetupPayload } from '../../shared/types'

export function registerSystemHandlers() {
  ipcMain.handle('system:status', () => ({ needsSetup: systemRepo.needsSetup() }))
  ipcMain.handle('system:purge', () => {
    systemRepo.purge()
  })
  ipcMain.handle('setup:save', (_event, payload: SetupPayload) => setupRepo.save(payload))
}