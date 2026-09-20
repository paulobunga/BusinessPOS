import { BrowserWindow } from 'electron'
import type { PrinterInfo } from '../../shared/print'

export interface PrintDriver {
  listPrinters(): Promise<PrinterInfo[]>
  print(html: string, opts: { deviceName?: string }): Promise<void>
}

export const systemPrintDriver: PrintDriver = {
  async listPrinters(): Promise<PrinterInfo[]> {
    try {
      const wins = BrowserWindow.getAllWindows()
      let wc = wins[0]?.webContents
      if (!wc) {
        const w = new BrowserWindow({ show: false })
        wc = w.webContents
        w.close()
      }
      const list: Array<{ name: string; isDefault?: boolean }> =
        typeof (wc as any).getPrintersAsync === 'function'
          ? await (wc as any).getPrintersAsync()
          : (wc as any).getPrinters()
      return list.map((p) => ({ name: p.name, isDefault: !!p.isDefault }))
    } catch {
      return []
    }
  },
  async print(html: string, opts: { deviceName?: string }): Promise<void> {
    const win = new BrowserWindow({ show: false })
    try {
      await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
      await new Promise<void>((resolve, reject) => {
        win.webContents.print(
          {
            silent: true,
            printBackground: false,
            ...(opts.deviceName ? { deviceName: opts.deviceName } : {}),
          },
          (success, err) => {
            err || !success ? reject(new Error(err || 'Print failed')) : resolve()
          },
        )
      })
    } finally {
      win.close()
    }
  },
}
