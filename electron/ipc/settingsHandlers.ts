import { ipcMain, dialog, app } from 'electron'
import fs from 'fs'
import path from 'path'
import { getDb, getDbPath, closeDb } from '../db/index.js'
import { settingsRepo } from '../db/repositories/settingsRepo.js'
import { usersRepo } from '../db/repositories/usersRepo.js'

export function registerSettingsHandlers() {
  ipcMain.handle('settings:get', () => settingsRepo.getAll())
  ipcMain.handle('settings:update', (_e, partial) => settingsRepo.setMany(partial))

  ipcMain.handle('users:setPin', (_e, userId: number, oldPin: string, newPin: string) => {
    return usersRepo.setPin(userId, oldPin, newPin)
  })

  ipcMain.handle('backup:export', async () => {
    const dbPath = getDbPath()
    const defaultName = `businesspos-backup-${new Date().toISOString().slice(0, 10)}.db`
    const result = await dialog.showSaveDialog({
      title: 'Export backup',
      defaultPath: path.join(app.getPath('documents'), defaultName),
      filters: [{ name: 'Database', extensions: ['db'] }],
    })
    if (result.canceled || !result.filePath) return null

    getDb().pragma('wal_checkpoint(TRUNCATE)')
    fs.copyFileSync(dbPath, result.filePath)
    return result.filePath
  })

  ipcMain.handle('backup:import', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Import backup',
      properties: ['openFile'],
      filters: [{ name: 'Database', extensions: ['db'] }],
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, message: 'Import canceled' }
    }

    const source = result.filePaths[0]
    const dbPath = getDbPath()
    closeDb()

    for (const suffix of ['-wal', '-shm']) {
      const sidecar = dbPath + suffix
      if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar)
    }

    fs.copyFileSync(source, dbPath)
    getDb()
    return { ok: true, message: `Restored from ${source}` }
  })
}