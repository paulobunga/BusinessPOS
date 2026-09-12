import { useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import { DialogDescription } from './ui/dialog'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Button } from './ui/button'

interface DebtModalProps {
  total: number
  onConfirm: (customerName: string) => void
  onClose: () => void
}

export function DebtModal({ total, onConfirm, onClose }: DebtModalProps) {
  const [name, setName] = useState('')
  const fmt = (n: number) => new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(n)

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-[360px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Record Debt</DialogTitle>
        </DialogHeader>
        <DialogDescription className="font-semibold">
          Amount: {fmt(total)}
        </DialogDescription>
        <div className="flex flex-col gap-1.5">
          <Label className="font-semibold">Customer Name</Label>
          <Input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Enter customer name"
            className="bg-background text-base"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button onClick={onClose} variant="outline" className="h-12 flex-1 font-semibold">
            Cancel
          </Button>
          <Button
            onClick={() => name.trim() && onConfirm(name.trim())}
            disabled={!name.trim()}
            className="h-12 flex-1 bg-warning font-bold text-white hover:bg-warning/80"
          >
            Confirm Debt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}