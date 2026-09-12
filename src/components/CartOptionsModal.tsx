import { BadgePercent, HandCoins } from 'lucide-react'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog'

interface CartOptionsModalProps {
  open: boolean
  hasItems: boolean
  onDiscount: () => void
  onDebt: () => void
  onClose: () => void
}

export function CartOptionsModal({ open, hasItems, onDiscount, onDebt, onClose }: CartOptionsModalProps) {
  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Order options</DialogTitle>
          <DialogDescription>Apply adjustments to the current order.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Button
            onClick={onDiscount}
            disabled={!hasItems}
            variant="outline"
            className="h-14 border-border bg-card font-bold"
          >
            <BadgePercent className="mr-2 h-5 w-5" />
            Discount
          </Button>
          <Button
            onClick={onDebt}
            disabled={!hasItems}
            variant="outline"
            className="h-14 border-warning bg-card font-bold text-warning"
          >
            <HandCoins className="mr-2 h-5 w-5" />
            Debt Sale
          </Button>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="border-border bg-card font-semibold" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}