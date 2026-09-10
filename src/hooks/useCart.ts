import { useState, useCallback, useMemo } from 'react'

export interface CartItemState {
  itemId: number
  itemName: string
  itemPrice: number
  addOnId: number | null
  addOnName: string | null
}

export function useCart() {
  const [items, setItems] = useState<CartItemState[]>([])
  const [discountCents, setDiscountCents] = useState(0)
  const [discountReason, setDiscountReason] = useState<string>('')

  const addItem = useCallback((item: { id: number; name: string; selling_price_cents: number }) => {
    setItems(prev => [...prev, {
      itemId: item.id,
      itemName: item.name,
      itemPrice: item.selling_price_cents,
      addOnId: null,
      addOnName: null,
    }])
  }, [])

  const setAddOn = useCallback((addOn: { id: number; name: string }) => {
    setItems(prev => {
      const updated = [...prev]
      const last = updated[updated.length - 1]
      if (last) {
        updated[updated.length - 1] = { ...last, addOnId: addOn.id, addOnName: addOn.name }
      }
      return updated
    })
  }, [])

  const removeItem = useCallback((index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index))
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
    setDiscountCents(0)
    setDiscountReason('')
  }, [])

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.itemPrice, 0), [items])
  const total = useMemo(() => Math.max(0, subtotal - discountCents), [subtotal, discountCents])

  return {
    items,
    addItem,
    setAddOn,
    removeItem,
    clearCart,
    discountCents,
    setDiscountCents,
    discountReason,
    setDiscountReason,
    subtotal,
    total,
    itemCount: items.length,
  }
}