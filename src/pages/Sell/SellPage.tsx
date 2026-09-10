import { useState } from 'react'
import { useProteins } from '../../hooks/useProteins'
import { useCart } from '../../hooks/useCart'
import { ProteinCard } from '../../components/ProteinCard'
import { StarchSelector } from '../../components/StarchSelector'
import { Cart } from '../../components/Cart'
import { DiscountModal } from '../../components/DiscountModal'
import { DebtModal } from '../../components/DebtModal'
import { useAuth } from '../../context/AuthContext'
import { useTill } from '../../context/TillContext'
import type { Protein } from '../../../shared/types'
import type { CreateSalePayload } from '../../../shared/types'

export function SellPage() {
  const { proteins, loading } = useProteins()
  const cart = useCart()
  const { userId } = useAuth()
  const { currentTill } = useTill()
  const [selectedProtein, setSelectedProtein] = useState<Protein | null>(null)
  const [showDiscount, setShowDiscount] = useState(false)
  const [showDebt, setShowDebt] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleProteinSelect = (protein: Protein) => {
    setSelectedProtein(protein)
    cart.addProtein(protein)
  }

  const handleStarchSelect = (id: number, name: string) => {
    cart.selectStarch(id, name)
    setSelectedProtein(null)
  }

  const completeSale = async (paymentMethod: 'cash' | 'debt', customerName?: string) => {
    if (cart.items.length === 0) return
    if (!currentTill) {
      setMessage('No till session is open. Open the till before completing a sale.')
      return
    }
    if (userId == null) {
      setMessage('You must be signed in to complete a sale.')
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      const payload: CreateSalePayload = {
        customer_name: paymentMethod === 'debt' ? customerName : undefined,
        subtotal_cents: cart.subtotal,
        discount_cents: cart.discountCents,
        discount_reason: cart.discountReason || undefined,
        total_cents: cart.total,
        debt_cents: paymentMethod === 'debt' ? cart.total : 0,
        payment_method: paymentMethod,
        till_session_id: currentTill.id,
        created_by: userId,
        items: cart.items.map(item => ({
          protein_id: item.proteinId,
          starch_id: item.starchId,
          price_cents: item.proteinPrice,
        })),
      }
      await window.api['sales:create'](payload)
      cart.clearCart()
    } catch (err) {
      setMessage('Sale failed: ' + (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ padding: 24, textAlign: 'center' }}>Loading menu...</div>

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Point of Sale</h1>

      <div style={{ display: 'flex', gap: 24 }}>
        {/* Protein Grid */}
        <div style={{ flex: 2 }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 16 }}>Select Protein</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {proteins.map(p => (
              <ProteinCard
                key={p.id}
                protein={p}
                selected={selectedProtein?.id === p.id}
                onSelect={handleProteinSelect}
              />
            ))}
          </div>

          {selectedProtein && (
            <div style={{ marginTop: 16, background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: 16, border: '1px solid var(--color-border)' }}>
              <p style={{ fontWeight: 600 }}>
                {selectedProtein.name} — pick a starch (free)
              </p>
              <StarchSelector onSelect={handleStarchSelect} />
            </div>
          )}
        </div>

        {/* Cart */}
        <div style={{ flex: 1, background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: 24, border: '1px solid var(--color-border)' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 16 }}>Current Sale</h2>

          {!currentTill && (
            <p style={{ color: 'var(--color-warning)', fontWeight: 600, marginBottom: 16 }}>
              No till session is open. Sales cannot be completed until the till is opened.
            </p>
          )}
          {message && (
            <p style={{ color: 'var(--color-danger)', fontWeight: 600, marginBottom: 16 }}>{message}</p>
          )}

          <Cart
            items={cart.items}
            subtotal={cart.subtotal}
            discountCents={cart.discountCents}
            discountReason={cart.discountReason}
            total={cart.total}
            onRemoveItem={cart.removeItem}
            onSetDiscount={() => setShowDiscount(true)}
            onDebtSale={() => setShowDebt(true)}
            onCompleteSale={() => completeSale('cash')}
          />
        </div>
      </div>

      {showDiscount && (
        <DiscountModal
          onApply={(cents, reason) => {
            cart.setDiscountCents(cents)
            cart.setDiscountReason(reason)
          }}
          onClose={() => setShowDiscount(false)}
        />
      )}

      {showDebt && (
        <DebtModal
          total={cart.total}
          onConfirm={(name) => {
            setShowDebt(false)
            completeSale('debt', name)
          }}
          onClose={() => setShowDebt(false)}
        />
      )}

      {saving && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <p style={{ background: 'var(--color-surface)', padding: '16px 24px', borderRadius: 'var(--radius-lg)', fontWeight: 700 }}>Saving sale...</p>
        </div>
      )}
    </div>
  )
}