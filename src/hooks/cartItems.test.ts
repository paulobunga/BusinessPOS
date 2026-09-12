import { describe, expect, it } from 'vitest'
import {
  addItemToCart,
  attachAddOnToCart,
  calcLineTotal,
  calcSubtotal,
  decrementCartLine,
  incrementCartLine,
  removeCartLine,
  type CartLines,
} from './cartItems'

const item = (id: number, name = 'Chicken', selling_price_cents = 8000) => ({ id, name, selling_price_cents })

describe('cartItems aggregation', () => {
  it('adds a line with quantity 1 on first tap', () => {
    const out = addItemToCart([], item(1))
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ itemId: 1, itemName: 'Chicken', itemPrice: 8000, addOnId: null, addOnName: null, quantity: 1 })
  })

  it('merges repeated taps into one line and bumps quantity', () => {
    let out = addItemToCart([], item(1))
    out = addItemToCart(out, item(1))
    out = addItemToCart(out, item(1))
    expect(out).toHaveLength(1)
    expect(out[0].quantity).toBe(3)
  })

  it('keeps distinct items as separate lines', () => {
    let out = addItemToCart([], item(1))
    out = addItemToCart(out, item(2, 'Goat', 10000))
    expect(out).toHaveLength(2)
    expect(out[0].itemId).toBe(1)
    expect(out[1].itemId).toBe(2)
  })

  it('increment bumps quantity', () => {
    let out = addItemToCart([], item(1))
    out = incrementCartLine(out, 0)
    expect(out[0].quantity).toBe(2)
  })

  it('decrement reduces quantity and removes the line at 1', () => {
    let out = addItemToCart([], item(1))
    out = addItemToCart(out, item(1))
    expect(out[0].quantity).toBe(2)
    out = decrementCartLine(out, 0)
    expect(out[0].quantity).toBe(1)
    out = decrementCartLine(out, 0)
    expect(out).toHaveLength(0)
  })

  it('removeCartLine drops the line at index', () => {
    let out = addItemToCart([], item(1))
    out = addItemToCart(out, item(2, 'Goat', 10000))
    out = removeCartLine(out, 0)
    expect(out).toHaveLength(1)
    expect(out[0].itemId).toBe(2)
  })

  it('attachAddOn moves one unit from the plain line into the variant line', () => {
    let out = addItemToCart([], item(1))
    out = attachAddOnToCart(out, { pricedItemId: 1, pricedItemName: 'Chicken', pricedPrice: 8000, addOnId: 9, addOnName: 'Banana' })
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ itemId: 1, addOnId: 9, addOnName: 'Banana', quantity: 1 })
  })

  it('attachAddOn with qty 3 leaves a plain line of 2 plus a variant of 1', () => {
    let out = addItemToCart([], item(1))
    out = addItemToCart(out, item(1))
    out = addItemToCart(out, item(1))
    out = attachAddOnToCart(out, { pricedItemId: 1, pricedItemName: 'Chicken', pricedPrice: 8000, addOnId: 9, addOnName: 'Banana' })
    expect(out).toHaveLength(2)
    const plain = out.find(l => l.addOnId === null)!
    const variant = out.find(l => l.addOnId === 9)!
    expect(plain.quantity).toBe(2)
    expect(variant.quantity).toBe(1)
  })

  it('attachAddOn merges into an existing variant line', () => {
    let out = addItemToCart([], item(1))
    out = attachAddOnToCart(out, { pricedItemId: 1, pricedItemName: 'Chicken', pricedPrice: 8000, addOnId: 9, addOnName: 'Banana' })
    out = addItemToCart(out, item(1))
    out = attachAddOnToCart(out, { pricedItemId: 1, pricedItemName: 'Chicken', pricedPrice: 8000, addOnId: 9, addOnName: 'Banana' })
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ addOnId: 9, quantity: 2 })
  })

  it('calcLineTotal and calcSubtotal multiply price by quantity', () => {
    const lines: CartLines = [
      { itemId: 1, itemName: 'Chicken', itemPrice: 8000, addOnId: null, addOnName: null, quantity: 2 },
      { itemId: 2, itemName: 'Goat', itemPrice: 10000, addOnId: 9, addOnName: 'Banana', quantity: 1 },
    ]
    expect(calcLineTotal(lines[0])).toBe(16000)
    expect(calcSubtotal(lines)).toBe(26000)
  })
})