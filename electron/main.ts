import { app, BrowserWindow, ipcMain, session } from 'electron'
import path from 'path'
import { registerAuthHandlers } from './ipc/authHandlers.js'
import { registerItemsHandlers } from './ipc/itemsHandlers.js'
import { registerCategoriesHandlers } from './ipc/categoriesHandlers.js'
import { registerAttributesHandlers } from './ipc/attributesHandlers.js'
import { registerSalesHandlers } from './ipc/salesHandlers.js'
import { registerExpensesHandlers } from './ipc/expensesHandlers.js'
import { registerDebtsHandlers } from './ipc/debtsHandlers.js'
import { registerReimbursementsHandlers } from './ipc/reimbursementsHandlers.js'
import { registerInventoryHandlers } from './ipc/inventoryHandlers.js'
import { registerWasteHandlers } from './ipc/wasteHandlers.js'
import { registerReportsHandlers } from './ipc/reportsHandlers.js'
import { registerSettingsHandlers } from './ipc/settingsHandlers.js'
import { registerSystemHandlers } from './ipc/systemHandlers.js'
import { registerUsersHandlers } from './ipc/usersHandlers.js'
import { registerAssetsHandlers } from './ipc/assetsHandlers.js'
import { registerAiHandlers } from './ipc/aiHandlers.js'

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

async function loadDevtoolsExtension() {
  const devPath =
    process.env.REACT_DEVTOOLS_PATH ||
    'C:\\Users\\PAULOBUNGA\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 8\\Extensions\\fmkadmapgofadopljbjfkapdkoienihi\\8.0.0_0'
  if (!process.env.VITE_DEV_SERVER_URL) return
  try {
    const ext = await session.defaultSession.loadExtension(devPath)
    console.log(`[devtools] React DevTools loaded: ${ext.id}`)
  } catch (err) {
    console.warn(
      '[devtools] could not load React DevTools panel — Components will be unavailable',
      err instanceof Error ? err.message : String(err),
    )
  }
}

app.whenReady().then(async () => {
  await loadDevtoolsExtension()
  createWindow()
})
app.on('window-all-closed', () => app.quit())

registerAuthHandlers()
registerItemsHandlers()
registerCategoriesHandlers()
registerAttributesHandlers()
registerSalesHandlers()
registerExpensesHandlers()
registerDebtsHandlers()
registerReimbursementsHandlers()
registerInventoryHandlers()
registerWasteHandlers()
registerReportsHandlers()
registerSettingsHandlers()
registerSystemHandlers()
registerUsersHandlers()
registerAssetsHandlers()
  registerAiHandlers()
ipcMain.handle('ping', () => 'pong')
ipcMain.handle('reports:exportCsv', () => '')
