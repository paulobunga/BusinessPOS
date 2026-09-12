import { useCallback, useMemo, useState } from 'react'
import {
  addItemToCart,
  attachAddOnToCart,
  calcSubtotal,
  decrementCartLine,
  incrementCartLine,
  removeCartLine,
  type CartLine,
} from './cartItems'

export type { CartLine }

/** @deprecated removed in Task 7 (CartItemState → CartLine) */
export type CartItemState = CartLine

export function useCart() {
  const [items, setItems] = useState<CartLine[]>([])
  const [discountCents, setDiscountCents] = useState(0)
  const [discountReason, setDiscountReason] = useState<string>('')

  const addItem = useCallback((item: { id: number; name: string; selling_price_cents: number }) => {
    setItems(prev => addItemToCart(prev, item))
  }, [])

  const increment = useCallback((index: number) => {
    setItems(prev => incrementCartLine(prev, index))
  }, [])

  const decrement = useCallback((index: number) => {
    setItems(prev => decrementCartLine(prev, index))
  }, [])

  const removeItem = useCallback((index: number) => {
    setItems(prev => removeCartLine(prev, index))
  }, [])

  const attachAddOn = useCallback((data: {
    pricedItemId: number
    pricedItemName: string
    pricedPrice: number
    addOnId: number
    addOnName: string
  }) => {
    setItems(prev => attachAddOnToCart(prev, data))
  }, [])

  /** @deprecated removed in Task 8 (use cart.attachAddOn directly) */
  const setAddOn = useCallback((addOn: { id: number; name: string }) => {
    setItems(prev => attachAddOnToCart(prev, {
      pricedItemId: prev[prev.length - 1]?.itemId ?? 0,
      pricedItemName: prev[prev.length - 1]?.itemName ?? '',
      pricedPrice: prev[prev.length - 1]?.itemPrice ?? 0,
      addOnId: addOn.id,
      addOnName: addOn.name,
    }))
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
    setDiscountCents(0)
    setDiscountReason('')
  }, [])

  const subtotal = useMemo(() => calcSubtotal(items), [items])
  const total = useMemo(() => Math.max(0, subtotal - discountCents), [subtotal, discountCents])
  const itemCount = useMemo(() => items.reduce((sum, l) => sum + l.quantity, 0), [items])

  return {
    items,
    addItem,
    increment,
    decrement,
    removeItem,
    attachAddOn,
    setAddOn,
    clearCart,
    discountCents,
    setDiscountCents,
    discountReason,
    setDiscountReason,
    subtotal,
    total,
    itemCount,
  }
}