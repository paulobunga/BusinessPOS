import { useState, useCallback, useMemo } from 'react'

export interface CartItemState {
  proteinId: number
  proteinName: string
  proteinPrice: number
  starchId: number | null
  starchName: string | null
}

export function useCart() {
  const [items, setItems] = useState<CartItemState[]>([])
  const [discountCents, setDiscountCents] = useState(0)
  const [discountReason, setDiscountReason] = useState<string>('')

  const addProtein = useCallback((protein: { id: number; name: string; selling_price_cents: number }) => {
    setItems(prev => [...prev, {
      proteinId: protein.id,
      proteinName: protein.name,
      proteinPrice: protein.selling_price_cents,
      starchId: null,
      starchName: null,
    }])
  }, [])

  const selectStarch = useCallback((starchId: number, starchName: string) => {
    setItems(prev => {
      const updated = [...prev]
      const last = updated[updated.length - 1]
      if (last) {
        updated[updated.length - 1] = { ...last, starchId, starchName }
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

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.proteinPrice, 0), [items])
  const total = useMemo(() => Math.max(0, subtotal - discountCents), [subtotal, discountCents])

  return {
    items,
    addProtein,
    selectStarch,
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