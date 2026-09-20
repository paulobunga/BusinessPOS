import type { KitchenOrder } from '../../shared/kitchen'

export function escapePrintHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(cents)
}

const STYLE = `<style>body { width: 72mm; font-family: monospace; } h1 { font-size: 20px; } .big { font-size: 28px; font-weight: bold; }</style>`

export function buildKotHtml(order: KitchenOrder): string {
  const customer = escapePrintHtml(order.customer_name || 'Walk-in')
  const createdAt = escapePrintHtml(order.created_at)
  const status = escapePrintHtml(order.kitchen_status)
  const lines = order.items
    .map((it) => `<div>${it.quantity} × ${escapePrintHtml(it.name_snapshot)}</div>`)
    .join('\n')
  const service = order.service_description
    ? `<div>${escapePrintHtml(order.service_description)}</div>`
    : ''
  return `<html><head>${STYLE}</head><body><div>*** KITCHEN ***</div><div class="big">#${order.id}</div><div>${customer}</div><div>${createdAt}</div>${lines}${service}<div>${status}</div></body></html>`
}

export function buildReceiptHtml(order: KitchenOrder, opts: { businessName: string; footer: string }): string {
  const business = escapePrintHtml(opts.businessName)
  const createdAt = escapePrintHtml(order.created_at)
  const customerLine = order.customer_name
    ? `<div>${escapePrintHtml(order.customer_name)}</div>`
    : ''
  const itemLines = order.items
    .map((it) => `<div>${escapePrintHtml(it.name_snapshot)} × ${it.quantity} ... ${formatMoney(it.line_total_cents)}</div>`)
    .join('\n')
  const subtotalLine = `<div>Subtotal: ${formatMoney(order.subtotal_cents)}</div>`
  const discountLine = order.discount_cents > 0
    ? `<div>Discount: ${formatMoney(order.discount_cents)}</div>`
    : ''
  const totalLine = `<div>Total: ${formatMoney(order.total_cents)}</div>`
  const paymentLine = `<div>${escapePrintHtml(order.payment_method ?? '')}</div>`
  const footerLine = opts.footer
    ? `<div>${escapePrintHtml(opts.footer)}</div>`
    : ''
  return `<html><head>${STYLE}</head><body><h1>${business}</h1><div>#${order.id}</div><div>${createdAt}</div>${customerLine}${itemLines}${subtotalLine}${discountLine}${totalLine}${paymentLine}${footerLine}<div>Thank you</div></body></html>`
}
