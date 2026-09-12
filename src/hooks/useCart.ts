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