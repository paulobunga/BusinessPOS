import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { registerAuthHandlers } from './ipc/authHandlers.js'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())

registerAuthHandlers()

// IPC handler stubs — will be replaced in subsequent tasks
ipcMain.handle('ping', () => 'pong')
ipcMain.handle('sales:create', () => { throw new Error('Not implemented') })
ipcMain.handle('sales:void', () => { throw new Error('Not implemented') })
ipcMain.handle('sales:list', () => [])
ipcMain.handle('sales:get', () => null)
ipcMain.handle('customers:create', () => { throw new Error('Not implemented') })
ipcMain.handle('customers:list', () => [])
ipcMain.handle('customers:get', () => null)
ipcMain.handle('payments:create', () => { throw new Error('Not implemented') })
ipcMain.handle('payments:list', () => [])
ipcMain.handle('expenses:create', () => { throw new Error('Not implemented') })
ipcMain.handle('expenses:update', () => { throw new Error('Not implemented') })
ipcMain.handle('expenses:delete', () => { throw new Error('Not implemented') })
ipcMain.handle('expenses:list', () => [])
ipcMain.handle('reimbursements:create', () => { throw new Error('Not implemented') })
ipcMain.handle('reimbursements:balance', () => ({ owed_to_owner_cents: 0 }))
ipcMain.handle('till:open', () => { throw new Error('Not implemented') })
ipcMain.handle('till:close', () => { throw new Error('Not implemented') })
ipcMain.handle('till:current', () => null)
ipcMain.handle('foodCost:purchases:list', () => [])
ipcMain.handle('foodCost:purchases:create', () => { throw new Error('Not implemented') })
ipcMain.handle('foodCost:cookEvents:list', () => [])
ipcMain.handle('foodCost:cookEvents:create', () => { throw new Error('Not implemented') })
ipcMain.handle('foodCost:summary', () => [])
ipcMain.handle('reports:daily', () => ({}))
ipcMain.handle('reports:weekly', () => ({}))
ipcMain.handle('reports:monthly', () => ({}))
ipcMain.handle('reports:exportCsv', () => '')
ipcMain.handle('proteins:list', () => [])
ipcMain.handle('proteins:upsert', () => { throw new Error('Not implemented') })
ipcMain.handle('proteins:setOutOfStock', () => { throw new Error('Not implemented') })
ipcMain.handle('starches:list', () => [])
ipcMain.handle('starches:upsert', () => { throw new Error('Not implemented') })
ipcMain.handle('settings:get', () => ({}))
ipcMain.handle('settings:update', () => { throw new Error('Not implemented') })
ipcMain.handle('backup:create', () => { throw new Error('Not implemented') })
ipcMain.handle('backup:restore', () => { throw new Error('Not implemented') })