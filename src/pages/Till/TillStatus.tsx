import { useTill } from '../../context/TillContext'
import { Button } from '../../components/ui/button'

interface TillStatusProps {
  onOpenTill: () => void
}

export function TillStatus({ onOpenTill }: TillStatusProps) {
  const { currentTill } = useTill()

  const fmt = (n: number) => new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(n)

  if (!currentTill) {
    return (
      <Button
        onClick={onOpenTill}
        variant="outline"
        className="flex h-[34px] items-center gap-2 rounded-[var(--radius-md)] border-warning bg-warning/10 px-3 text-[0.875rem] font-semibold text-warning"
      >
        <span className="size-2 rounded-full bg-warning" />
        Till Closed — Open Till
      </Button>
    )
  }

  return (
    <div className="flex h-[34px] items-center gap-2 rounded-[var(--radius-md)] border border-success bg-success/10 px-3 text-[0.875rem] font-semibold">
      <span className="size-2 rounded-full bg-success" />
      Till Open — {fmt(currentTill.opening_float_cents)}
    </div>
  )
}