import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { registerAuthHandlers } from './ipc/authHandlers.js'
import { registerMenuHandlers } from './ipc/menuHandlers.js'
import { registerSalesHandlers } from './ipc/salesHandlers.js'
import { registerExpensesHandlers } from './ipc/expensesHandlers.js'
import { registerDebtsHandlers } from './ipc/debtsHandlers.js'

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
registerMenuHandlers()
registerSalesHandlers()
registerExpensesHandlers()
registerDebtsHandlers()
ipcMain.handle('ping', () => 'pong')
ipcMain.handle('customers:create', () => { throw new Error('Not implemented') })
ipcMain.handle('customers:list', () => [])
ipcMain.handle('customers:get', () => null)
ipcMain.handle('payments:create', () => { throw new Error('Not implemented') })
ipcMain.handle('payments:list', () => [])
ipcMain.handle('reimbursements:create', () => { throw new Error('Not implemented') })
ipcMain.handle('reimbursements:balance', () => ({ owed_to_owner_cents: 0 }))
ipcMain.handle('foodCost:purchases:list', () => [])
ipcMain.handle('foodCost:purchases:create', () => { throw new Error('Not implemented') })
ipcMain.handle('foodCost:cookEvents:list', () => [])
ipcMain.handle('foodCost:cookEvents:create', () => { throw new Error('Not implemented') })
ipcMain.handle('foodCost:summary', () => [])
ipcMain.handle('reports:daily', () => ({}))
ipcMain.handle('reports:weekly', () => ({}))
ipcMain.handle('reports:monthly', () => ({}))
ipcMain.handle('reports:exportCsv', () => '')

ipcMain.handle('settings:get', () => ({}))
ipcMain.handle('settings:update', () => { throw new Error('Not implemented') })
ipcMain.handle('backup:create', () => { throw new Error('Not implemented') })
ipcMain.handle('backup:restore', () => { throw new Error('Not implemented') })