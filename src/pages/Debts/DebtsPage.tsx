import { useState } from 'react'
import { useDebts } from '../../hooks/useDebts'
import { useAuth } from '../../context/AuthContext'
import { useTill } from '../../context/TillContext'
import { Button } from '../../components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'

const fmt = new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 })

interface OpenDebt {
  sale_id: number
  customer_name: string
  debt_cents: number
  total_cents: number
  paid_cents: number
  created_at: string
}

export function DebtsPage() {
  const { debts, loading, recordPayment } = useDebts()
  const { userId } = useAuth()
  const { currentTill } = useTill()
  const [paying, setPaying] = useState<OpenDebt | null>(null)
  const [amount, setAmount] = useState('')
  const [processing, setProcessing] = useState(false)

  const handlePay = async () => {
    if (!paying || !amount || !userId) return
    const cents = Math.round(parseFloat(amount))
    if (isNaN(cents) || cents <= 0) return
    const owed = paying.debt_cents - paying.paid_cents
    const payCents = Math.min(cents, owed)
    setProcessing(true)
    await recordPayment(paying.sale_id, payCents, currentTill?.id ?? null, userId)
    setProcessing(false)
    setPaying(null)
    setAmount('')
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Customer Debts</h1>
        <span className="text-[0.9375rem] font-bold">
          Total Owed: {fmt.format(debts.reduce((s: number, d: OpenDebt) => s + (d.debt_cents - d.paid_cents), 0))}
        </span>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground">Loading...</p>
      ) : debts.length === 0 ? (
        <p className="p-12 text-center text-lg text-muted-foreground">No open debts</p>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border">
          <Table className="table-zebra">
            <TableHeader>
              <TableRow className="bg-card hover:bg-card">
                <TableHead>Customer</TableHead>
                <TableHead>Amount Owed</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Remaining</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {debts.map((d: OpenDebt) => (
                <TableRow key={d.sale_id}>
                  <TableCell>{d.customer_name || 'Unknown'}</TableCell>
                  <TableCell>{fmt.format(d.debt_cents)}</TableCell>
                  <TableCell>{fmt.format(d.paid_cents)}</TableCell>
                  <TableCell className="font-bold">{fmt.format(d.debt_cents - d.paid_cents)}</TableCell>
                  <TableCell>{new Date(d.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      onClick={() => { setPaying(d); setAmount(String(d.debt_cents - d.paid_cents)) }}
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

      <Dialog open={paying != null} onOpenChange={(o) => { if (!o) { setPaying(null); setAmount('') } }}>
        <DialogContent className="max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Record Payment</DialogTitle>
          </DialogHeader>
          <div>
            <p className="mb-1 font-semibold">
              Customer: {paying?.customer_name || 'Unknown'}
            </p>
            <p className="mb-3 font-semibold">
              Remaining: {paying ? fmt.format(paying.debt_cents - paying.paid_cents) : ''}
            </p>
            <div className="flex flex-col gap-1.5">
              <Label className="font-semibold">Payment Amount (UGX)</Label>
              <Input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="Enter amount"
                className="bg-background text-base"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => { setPaying(null); setAmount('') }} variant="outline" className="h-12 flex-1 font-semibold">
              Cancel
            </Button>
            <Button
              onClick={handlePay}
              disabled={processing || !amount || parseFloat(amount) <= 0}
              className="h-12 flex-1 font-bold"
            >
              {processing ? 'Saving...' : 'Confirm Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}