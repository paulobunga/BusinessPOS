import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { registerAuthHandlers } from './ipc/authHandlers.js'
import { registerMenuHandlers } from './ipc/menuHandlers.js'
import { registerSalesHandlers } from './ipc/salesHandlers.js'
import { registerExpensesHandlers } from './ipc/expensesHandlers.js'
import { registerDebtsHandlers } from './ipc/debtsHandlers.js'
import { registerReimbursementsHandlers } from './ipc/reimbursementsHandlers.js'
import { registerInventoryHandlers } from './ipc/inventoryHandlers.js'
import { registerWasteHandlers } from './ipc/wasteHandlers.js'
import { registerReportsHandlers } from './ipc/reportsHandlers.js'
import { registerSettingsHandlers } from './ipc/settingsHandlers.js'

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
registerReimbursementsHandlers()
registerInventoryHandlers()
registerWasteHandlers()
registerReportsHandlers()
registerSettingsHandlers()
ipcMain.handle('ping', () => 'pong')
ipcMain.handle('customers:create', () => { throw new Error('Not implemented') })
ipcMain.handle('customers:list', () => [])
ipcMain.handle('customers:get', () => null)
ipcMain.handle('payments:create', () => { throw new Error('Not implemented') })
ipcMain.handle('payments:list', () => [])
ipcMain.handle('reports:exportCsv', () => '')
