export interface CartLine {
  itemId: number
  itemName: string
  itemPrice: number
  addOnId: number | null
  addOnName: string | null
  quantity: number
}

export type CartLines = CartLine[]

export function addItemToCart(
  lines: CartLines,
  item: { id: number; name: string; selling_price_cents: number }
): CartLines {
  const out = [...lines]
  const idx = out.findIndex(l => l.itemId === item.id && l.addOnId === null)
  if (idx !== -1) {
    const l = out[idx]
    out[idx] = { ...l, itemPrice: item.selling_price_cents, quantity: l.quantity + 1 }
  } else {
    out.push({ itemId: item.id, itemName: item.name, itemPrice: item.selling_price_cents, addOnId: null, addOnName: null, quantity: 1 })
  }
  return out
}

export function incrementCartLine(lines: CartLines, index: number): CartLines {
  const out = [...lines]
  const l = out[index]
  if (!l) return lines
  out[index] = { ...l, quantity: l.quantity + 1 }
  return out
}

export function decrementCartLine(lines: CartLines, index: number): CartLines {
  const out = [...lines]
  const l = out[index]
  if (!l) return lines
  if (l.quantity > 1) {
    out[index] = { ...l, quantity: l.quantity - 1 }
  } else {
    out.splice(index, 1)
  }
  return out
}

export function removeCartLine(lines: CartLines, index: number): CartLines {
  return lines.filter((_, i) => i !== index)
}

export function attachAddOnToCart(
  lines: CartLines,
  data: { pricedItemId: number; pricedItemName: string; pricedPrice: number; addOnId: number; addOnName: string }
): CartLines {
  const out = [...lines]
  const plainIdx = out.findIndex(l => l.itemId === data.pricedItemId && l.addOnId === null)
  if (plainIdx === -1) return lines
  if (out[plainIdx].quantity > 1) {
    out[plainIdx] = { ...out[plainIdx], quantity: out[plainIdx].quantity - 1 }
  } else {
    out.splice(plainIdx, 1)
  }
  const variantIdx = out.findIndex(l => l.itemId === data.pricedItemId && l.addOnId === data.addOnId)
  if (variantIdx === -1) {
    out.push({
      itemId: data.pricedItemId,
      itemName: data.pricedItemName,
      itemPrice: data.pricedPrice,
      addOnId: data.addOnId,
      addOnName: data.addOnName,
      quantity: 1,
    })
  } else {
    out[variantIdx] = { ...out[variantIdx], quantity: out[variantIdx].quantity + 1 }
  }
  return out
}

export function calcLineTotal(line: CartLine): number {
  return line.itemPrice * line.quantity
}

export function calcSubtotal(lines: CartLines): number {
  return lines.reduce((sum, l) => sum + calcLineTotal(l), 0)
}