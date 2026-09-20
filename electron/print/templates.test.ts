// electron/print/templates.test.ts
import { describe, test, expect } from 'vitest'
import { buildKotHtml, buildReceiptHtml, escapePrintHtml } from './templates'
import type { KitchenOrder } from '../../shared/kitchen'
const order = {
  id: 7, customer_name: 'Amina <VIP>', service_description: '',
  created_at: '2026-09-20 12:00:00', kitchen_status: 'new',
  subtotal_cents: 15000, discount_cents: 0, total_cents: 15000, payment_method: 'cash',
  items: [{ name_snapshot: 'Chicken & Chips', quantity: 2, line_total_cents: 15000 }],
} as unknown as KitchenOrder
describe('templates', () => {
  test('escapes html', () => { expect(escapePrintHtml('<a>&"')).toBe('&lt;a&gt;&amp;&quot;') })
  test('kot contains id and items escaped', () => {
    const html = buildKotHtml(order)
    expect(html).toContain('#7')
    expect(html).toContain('Chicken &amp; Chips')
    expect(html).not.toContain('<VIP>')
  })
  test('receipt contains totals and footer', () => {
    const html = buildReceiptHtml(order, { businessName: 'My Restaurant', footer: 'Come again' })
    expect(html).toContain('My Restaurant')
    expect(html).toContain('Come again')
    expect(html).toContain('#7')
  })
})
