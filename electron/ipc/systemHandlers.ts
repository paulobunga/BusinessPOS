import { ipcMain } from 'electron'
import { systemRepo } from '../db/repositories/systemRepo.js'
import { setupRepo } from '../db/repositories/setupRepo.js'
import { getKdsStatus, startKdsServer, stopKdsServer } from '../kds/kdsServer.js'
import { buildKitchenUrls, getKdsPort } from '../kds/kdsConfig.js'
import type { SetupPayload } from '../../shared/types'

export function registerSystemHandlers() {
  ipcMain.handle('system:status', () => ({ needsSetup: systemRepo.needsSetup() }))
  ipcMain.handle('system:purge', () => {
    systemRepo.purge()
  })
  ipcMain.handle('setup:save', (_event, payload: SetupPayload) => setupRepo.save(payload))
  ipcMain.handle('system:kitchenStatus', () => getKdsStatus())
  ipcMain.handle('system:restartKds', async (_e, port?: number) => {
    await stopKdsServer()
    return startKdsServer(port)
  })
  ipcMain.handle('system:kitchenUrls', () => buildKitchenUrls(getKdsStatus().port ?? getKdsPort()))
}