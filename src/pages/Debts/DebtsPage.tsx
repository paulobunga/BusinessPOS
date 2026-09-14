import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDebts } from '../../hooks/useDebts'
import { useAuth } from '../../context/AuthContext'
import { useTill } from '../../context/TillContext'
import { Button } from '../../components/ui/button'
import { PayOnAccountDialog } from '../../components/PayOnAccountDialog'
import { DebtAgingBadge } from '../../components/DebtAgingBadge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import type { CustomerBalance } from '../../../shared/types'

const fmt = (n: number) => new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(n)

export function DebtsPage() {
  const { balances, loading, error, payOnAccount } = useDebts()
  const { userId } = useAuth()
  const { currentTill } = useTill()
  const navigate = useNavigate()

  const [paying, setPaying] = useState<CustomerBalance | null>(null)
  const [processing, setProcessing] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)

  const totalOwed = balances.reduce((s, b) => s + b.total_owed_cents - b.total_paid_cents, 0)

  const handlePay = async (amountCents: number) => {
    if (!paying || !userId) return
    setProcessing(true)
    setPayError(null)
    try {
      await payOnAccount({
        customer_name: paying.customer_name,
        amount_cents: amountCents,
        till_session_id: currentTill?.id ?? null,
        created_by: userId,
      })
      setPaying(null)
    } catch (err) {
      setPayError((err as Error).message || 'Payment failed')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Customer Debts</h1>
        <span className="text-[0.9375rem] font-bold">Total Owed: {fmt(totalOwed)}</span>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground">Loading...</p>
      ) : error ? (
        <p className="text-center font-semibold text-destructive">{error}</p>
      ) : balances.length === 0 ? (
        <p className="p-12 text-center text-lg text-muted-foreground">No open debts</p>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border">
          <Table className="table-zebra">
            <TableHeader>
              <TableRow className="bg-card hover:bg-card">
                <TableHead>Customer</TableHead>
                <TableHead>Total Owed</TableHead>
                <TableHead>Unpaid Orders</TableHead>
                <TableHead>Aging</TableHead>
                <TableHead>Last Payment</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {balances.map((b) => (
                <TableRow key={b.customer_name} className="cursor-pointer" onClick={() => navigate(`/debts/${encodeURIComponent(b.customer_name)}`)}>
                  <TableCell className="font-semibold">{b.customer_name}</TableCell>
                  <TableCell className="font-bold">{fmt(b.total_owed_cents - b.total_paid_cents)}</TableCell>
                  <TableCell>{b.unpaid_orders}</TableCell>
                  <TableCell>
                    <DebtAgingBadge
                      daysOpen={Math.floor((Date.now() - new Date(b.oldest_open_date).getTime()) / 86400000)}
                      lastPaymentAt={b.last_payment_at}
                    />
                  </TableCell>
                  <TableCell>{b.last_payment_at ? new Date(b.last_payment_at).toLocaleDateString() : '—'}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button
                      onClick={() => { setPaying(b); setPayError(null) }}
                      className="bg-primary text-[0.8125rem] font-semibold"
                    >
                      Record Payment
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <PayOnAccountDialog
        open={paying != null}
        customerName={paying?.customer_name ?? ''}
        totalOwedCents={paying ? paying.total_owed_cents - paying.total_paid_cents : 0}
        processing={processing}
        error={payError}
        onConfirm={handlePay}
        onClose={() => { setPaying(null); setPayError(null) }}
      />
    </div>
  )
}