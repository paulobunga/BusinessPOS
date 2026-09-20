import { settingsRepo } from '../db/repositories/settingsRepo'
import { salesRepo } from '../db/repositories/salesRepo'
import { buildKotHtml, buildReceiptHtml } from './templates'
import { systemPrintDriver, type PrintDriver } from './drivers'
import type { KitchenOrder } from '../../shared/kitchen'
import type { PrintKind, PrintResult } from '../../shared/print'

export function createPrintService(driver: PrintDriver = systemPrintDriver) {
  let tail: Promise<unknown> = Promise.resolve()
  const enqueue = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = tail.then(fn, fn)
    tail = run.catch(() => {})
    return run
  }
  const receiptOpts = () => ({
    businessName: settingsRepo.get('business_name') ?? 'My Restaurant',
    footer: settingsRepo.get('receipt_footer') ?? '',
  })
  const svc = {
    listPrinters: () => driver.listPrinters(),
    printTicket: (orderId: number, kind: PrintKind): Promise<PrintResult> =>
      enqueue(async () => {
        try {
          if (!Number.isInteger(orderId)) return { ok: false, error: `Invalid order id ${String(orderId)}` }
          if (kind !== 'kot' && kind !== 'receipt') return { ok: false, error: `Invalid print kind ${String(kind)}` }
          if (settingsRepo.get('print_enabled') === 'false') return { ok: false, skipped: 'printing disabled' }
          const order = salesRepo.getWithItems(orderId) as unknown as KitchenOrder
          const html = kind === 'kot' ? buildKotHtml(order) : buildReceiptHtml(order, receiptOpts())
          const device = settingsRepo.get('print_device_name') || undefined
          await driver.print(html, { deviceName: device })
          return { ok: true }
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : 'Print failed' }
        }
      }),
    printTest: (kind: PrintKind = 'receipt'): Promise<PrintResult> =>
      enqueue(async () => {
        try {
          const demo = {
            id: 0,
            customer_name: 'Test',
            service_description: '',
            created_at: new Date().toISOString(),
            kitchen_status: 'new',
            subtotal_cents: 1000,
            discount_cents: 0,
            total_cents: 1000,
            payment_method: 'cash',
            items: [{ name_snapshot: 'Test item', quantity: 1, line_total_cents: 1000 }],
          } as unknown as KitchenOrder
          const html = kind === 'kot' ? buildKotHtml(demo) : buildReceiptHtml(demo, receiptOpts())
          const device = settingsRepo.get('print_device_name') || undefined
          await driver.print(html, { deviceName: device })
          return { ok: true }
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : 'Print failed' }
        }
      }),
    maybeAutoPrint: async (order: KitchenOrder): Promise<PrintResult> => {
      try {
        if (settingsRepo.get('print_enabled') === 'false') return { ok: false, skipped: 'printing disabled' }
        const kot = settingsRepo.get('print_kot_auto') !== 'false'
        const receipt = settingsRepo.get('print_receipt_auto') === 'true'
        if (!kot && !receipt) return { ok: false, skipped: 'auto-print off' }
        // reuse own printTicket so device/validation stay in one place
        let last: PrintResult = { ok: true }
        if (kot) last = await svc.printTicket(order.id, 'kot')
        if (receipt) last = await svc.printTicket(order.id, 'receipt')
        return last
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Print failed' }
      }
    },
  }
  return svc
}

export const printService = createPrintService()
