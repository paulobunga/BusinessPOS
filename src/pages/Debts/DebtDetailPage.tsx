import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useDebts } from '../../hooks/useDebts'
import { useAuth } from '../../context/AuthContext'
import { useTill } from '../../context/TillContext'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { DebtAgingBadge } from '../../components/DebtAgingBadge'
import { PayOnAccountDialog } from '../../components/PayOnAccountDialog'
import { PaginationFooter } from '../../components/PaginationFooter'
import { usePagination } from '../../hooks/usePagination'
import type { CustomerDetail, OpenDebt } from '../../../shared/types'

const fmt = (n: number) => new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(n)

const safeDecode = (s: string) => {
  try {
    return decodeURIComponent(s)
  } catch {
    return ''
  }
}

export function DebtDetailPage() {
  const { customerName = '' } = useParams()
  const name = safeDecode(customerName)
  const { customerDetail, recordPayment, writeOff, payOnAccount } = useDebts()
  const { userId } = useAuth()
  const { currentTill } = useTill()

  const [detail, setDetail] = useState<CustomerDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const [payingSale, setPayingSale] = useState<OpenDebt | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payProcessing, setPayProcessing] = useState(false)

  const [payingAccount, setPayingAccount] = useState(false)
  const [accountProcessing, setAccountProcessing] = useState(false)
  const [accountError, setAccountError] = useState<string | null>(null)

  const [writingOff, setWritingOff] = useState<OpenDebt | null>(null)
  const [writeOffAmount, setWriteOffAmount] = useState('')
  const [writeOffReason, setWriteOffReason] = useState('')
  const [writeOffError, setWriteOffError] = useState<string | null>(null)
  const [writeOffProcessing, setWriteOffProcessing] = useState(false)

  const openDebtsPager = usePagination(detail?.open_debts ?? [])
  const paymentsPager = usePagination(detail?.payments ?? [])

  const reload = async (target: string) => {
    setLoading(true)
    try {
      setDetail(await customerDetail(target))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void reload(name) }, [name]) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePerSalePay = async (saleId: number) => {
    const cents = Math.round(parseFloat(payAmount))
    if (!userId || !payingSale || isNaN(cents) || cents <= 0) return
    setPayProcessing(true)
    try {
      await recordPayment(saleId, Math.min(cents, payingSale.remaining_cents), currentTill?.id ?? null, userId)
      setPayingSale(null)
      setPayAmount('')
      await reload(name)
    } finally {
      setPayProcessing(false)
    }
  }

  const handleWriteOff = async (saleId: number) => {
    const cents = Math.round(parseFloat(writeOffAmount))
    if (!userId || !writingOff || isNaN(cents) || cents <= 0) return
    setWriteOffProcessing(true)
    setWriteOffError(null)
    try {
      await writeOff(saleId, Math.min(cents, writingOff.remaining_cents), writeOffReason.trim(), userId)
      setWritingOff(null)
      setWriteOffAmount('')
      setWriteOffReason('')
      await reload(name)
    } catch (err) {
      setWriteOffError((err as Error).message || 'Write-off failed')
    } finally {
      setWriteOffProcessing(false)
    }
  }

  const handlePayAccount = async (amountCents: number) => {
    if (!userId) return
    setAccountProcessing(true)
    setAccountError(null)
    try {
      await payOnAccount({
        customer_name: name,
        amount_cents: amountCents,
        till_session_id: currentTill?.id ?? null,
        created_by: userId,
      })
      setPayingAccount(false)
      await reload(name)
    } catch (err) {
      setAccountError((err as Error).message || 'Payment failed')
    } finally {
      setAccountProcessing(false)
    }
  }

  if (loading && !detail) return <div className="p-6 text-center">Loading...</div>

  if (!detail) {
    return (
      <div className="p-6">
        <Link to="/debts" className="mb-4 inline-flex items-center gap-1.5 font-semibold text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Debts
        </Link>
        <p className="p-12 text-center text-lg text-muted-foreground">No open debts for this customer</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <Link to="/debts" className="inline-flex items-center gap-1.5 font-semibold text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Debts
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{detail.customer_name}</h1>
        <span className="text-[0.9375rem] font-bold">Total Owed: {fmt(detail.total_owed_cents)}</span>
      </div>

      <Button onClick={() => { setPayingAccount(true); setAccountError(null) }} disabled={detail.total_owed_cents <= 0} className="w-fit bg-primary font-bold">
        Pay Balance ({fmt(detail.total_owed_cents)})
      </Button>

      {detail.open_debts.length === 0 ? (
        <p className="p-8 text-center text-lg text-muted-foreground">No open orders</p>
      ) : (
        <div className="flex flex-col gap-3">
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border">
          <Table className="table-zebra">
            <TableHeader>
              <TableRow className="bg-card hover:bg-card">
                <TableHead>Date</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Written Off</TableHead>
                <TableHead>Remaining</TableHead>
                <TableHead>Aging</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {openDebtsPager.slice.map((d) => (
                <TableRow key={d.sale_id}>
                  <TableCell>{new Date(d.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{d.item_names || '—'}</TableCell>
                  <TableCell>{fmt(d.total_cents)}</TableCell>
                  <TableCell>{fmt(d.paid_cents)}</TableCell>
                  <TableCell>{d.written_off_cents > 0 ? <span className="font-semibold text-destructive">{fmt(d.written_off_cents)}</span> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="font-bold">{fmt(d.remaining_cents)}</TableCell>
                  <TableCell><DebtAgingBadge daysOpen={d.days_open} lastPaymentAt={d.last_payment_at} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        onClick={() => { setPayingSale(d); setPayAmount(String(d.remaining_cents)) }}
                        className="bg-primary text-[0.8125rem] font-semibold"
                      >
                        Record Payment
                      </Button>
                      <Button
                        onClick={() => { setWritingOff(d); setWriteOffAmount(String(d.remaining_cents)); setWriteOffReason('') }}
                        variant="outline"
                        className="h-9 border-destructive/40 bg-background text-[0.8125rem] font-semibold text-destructive"
                      >
                        Write Off
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <PaginationFooter pager={openDebtsPager} />
        </div>
      )}

      <div>
        <h2 className="mb-2 text-lg font-bold">Payment History</h2>
        {detail.payments.length === 0 ? (
          <p className="text-muted-foreground">No payments recorded yet</p>
        ) : (
          <div>
            <div className="rounded-[var(--radius-lg)] border border-border">
              {paymentsPager.slice.map((p) => (
                <div key={p.id} className="flex items-center justify-between border-b border-border px-4 py-2 last:border-b-0">
                  <div>
                    <p className="font-semibold">{fmt(p.amount_cents)}</p>
                    <p className="text-xs text-muted-foreground">
                      Sale #{p.sale_id} · {new Date(p.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">Settled {p.sale_total_cents > 0 ? `sale total ${fmt(p.sale_total_cents)}` : ''}</span>
                </div>
              ))}
            </div>
            <PaginationFooter pager={paymentsPager} />
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-lg font-bold">Write-offs</h2>
        {detail.write_offs.length === 0 ? (
          <p className="text-muted-foreground">No debt has been written off for this customer</p>
        ) : (
          <div className="rounded-[var(--radius-lg)] border border-border">
            {detail.write_offs.map((w) => (
              <div key={w.id} className="flex items-center justify-between border-b border-border px-4 py-2 last:border-b-0">
                <div>
                  <p className="font-semibold text-destructive">−{fmt(w.amount_cents)}</p>
                  <p className="text-xs text-muted-foreground">
                    {w.reason} · Sale #{w.sale_id} · {new Date(w.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={payingSale != null} onOpenChange={(o) => { if (!o) { setPayingSale(null); setPayAmount('') } }}>
        <DialogContent className="max-w-[360px]">
          <DialogHeader><DialogTitle className="text-xl font-bold">Record Payment</DialogTitle></DialogHeader>
          <p className="mb-3 font-semibold">
            Remaining: {payingSale ? fmt(payingSale.remaining_cents) : ''}
          </p>
          <Label className="flex w-full flex-col gap-1.5 font-semibold">
            Payment Amount (UGX)
            <Input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="bg-background text-base" autoFocus />
          </Label>
          <DialogFooter>
            <Button onClick={() => { setPayingSale(null); setPayAmount('') }} variant="outline" className="h-12 flex-1 font-semibold">Cancel</Button>
            <Button onClick={() => payingSale && handlePerSalePay(payingSale.sale_id)} disabled={payProcessing || !payAmount || parseFloat(payAmount) <= 0} className="h-12 flex-1 font-bold">
              {payProcessing ? 'Saving...' : 'Confirm Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PayOnAccountDialog
        open={payingAccount}
        customerName={name}
        totalOwedCents={detail.total_owed_cents}
        processing={accountProcessing}
        error={accountError}
        onConfirm={handlePayAccount}
        onClose={() => { setPayingAccount(false); setAccountError(null) }}
      />

      <Dialog open={writingOff != null} onOpenChange={(o) => { if (!o) { setWritingOff(null); setWriteOffAmount(''); setWriteOffReason(''); setWriteOffError(null) } }}>
        <DialogContent className="max-w-[380px]">
          <DialogHeader><DialogTitle className="text-xl font-bold">Write Off Debt</DialogTitle></DialogHeader>
          <p className="mb-3 font-semibold">
            Remaining: {writingOff ? fmt(writingOff.remaining_cents) : ''}
          </p>
          <div className="flex flex-col gap-4">
            <Label className="flex w-full flex-col gap-1.5 font-semibold">
              Amount (UGX)
              <Input type="number" value={writeOffAmount} onChange={e => setWriteOffAmount(e.target.value)} className="bg-background text-base" autoFocus />
            </Label>
            <Label className="flex w-full flex-col gap-1.5 font-semibold">
              Reason
              <Input
                type="text"
                value={writeOffReason}
                onChange={e => setWriteOffReason(e.target.value)}
                placeholder="e.g. Customer is no longer reachable"
                className="bg-background text-base"
              />
            </Label>
            {writeOffError && (
              <p className="text-sm font-semibold text-destructive">{writeOffError}</p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => { setWritingOff(null); setWriteOffAmount(''); setWriteOffReason(''); setWriteOffError(null) }} variant="outline" className="h-12 flex-1 font-semibold">Cancel</Button>
            <Button
              onClick={() => writingOff && handleWriteOff(writingOff.sale_id)}
              disabled={writeOffProcessing || !writeOffAmount || parseFloat(writeOffAmount) <= 0 || !writeOffReason.trim()}
              className="h-12 flex-1 bg-destructive font-bold text-white hover:bg-destructive/80"
            >
              {writeOffProcessing ? 'Saving...' : 'Confirm Write Off'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
