import { useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Button } from '../../components/ui/button'

interface OpenTillModalProps {
  onOpen: (floatCents: number) => void
  onClose: () => void
}

export function OpenTillModal({ onOpen, onClose }: OpenTillModalProps) {
  const [balance, setBalance] = useState('')

  const handleOpen = () => {
    const parsed = parseInt(balance, 10)
    if (!isNaN(parsed) && parsed >= 0) {
      onOpen(parsed)
      onClose()
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-[360px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Open Till</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label className="font-semibold">Opening Float (UGX)</Label>
          <Input
            type="number"
            value={balance}
            onChange={e => setBalance(e.target.value)}
            className="bg-background text-base"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button onClick={onClose} variant="outline" className="h-12 flex-1 font-semibold">
            Cancel
          </Button>
          <Button onClick={handleOpen} className="h-12 flex-1 bg-success font-bold text-white hover:bg-success/80">
            Open Till
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}