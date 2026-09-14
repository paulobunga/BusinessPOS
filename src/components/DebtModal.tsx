import { useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Button } from './ui/button'
import { BalanceWarning } from './BalanceWarning'

interface DebtModalProps {
  total: number
  onConfirm: (customerName: string, paidNowCents: number) => void
  onClose: () => void
}

let balanceTimer: ReturnType<typeof setTimeout> | undefined

export function DebtModal({ total, onConfirm, onClose }: DebtModalProps) {
  const [name, setName] = useState('')
  const [paidNow, setPaidNow] = useState('')
  const [owed, setOwed] = useState(0)
  const fmt = (n: number) => new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(n)

  const paidNowCents = Math.min(total, Math.max(0, Math.round(parseFloat(paidNow) || 0)))
  const carried = Math.max(total - paidNowCents, 0)

  const handleNameBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const value = e.target.value.trim()
    if (balanceTimer) clearTimeout(balanceTimer)
    if (!value) { setOwed(0); return }
    balanceTimer = setTimeout(() => {
      window.api['debts:balanceByName'](value)
        .then(setOwed)
        .catch(() => setOwed(0))
    }, 300)
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-[360px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Debt / Partial Payment</DialogTitle>
        </DialogHeader>
        <DialogDescription className="font-semibold">Total: {fmt(total)}</DialogDescription>
        <div className="flex flex-col gap-3">
          {owed > 0 && <BalanceWarning owedCents={owed} />}
          <div className="flex flex-col gap-1.5">
            <Label className="font-semibold">Customer Name</Label>
            <Input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={handleNameBlur}
              placeholder="Enter customer name"
              className="h-11 bg-background text-base"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="font-semibold">Paid Now (UGX)</Label>
            <Input
              type="number"
              value={paidNow}
              onChange={e => setPaidNow(e.target.value)}
              placeholder="0"
              className="bg-background text-base"
            />
            <Button
              type="button"
              variant="outline"
              className="h-10 border-border bg-card text-[0.8125rem] font-semibold"
              onClick={() => setPaidNow(String(total))}
            >
              Pay in full ({fmt(total)})
            </Button>
          </div>
          <p className="text-sm font-semibold text-muted-foreground">
            To carry forward: <span className="text-warning">{fmt(carried)}</span>
          </p>
        </div>
        <DialogFooter>
          <Button onClick={onClose} variant="outline" className="h-12 flex-1 font-semibold">Cancel</Button>
          <Button
            onClick={() => onConfirm(name.trim(), paidNowCents)}
            disabled={!name.trim()}
            className="h-12 flex-1 bg-warning font-bold text-white hover:bg-warning/80"
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}