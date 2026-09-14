import { AlertTriangle } from 'lucide-react'

export function BalanceWarning({ owedCents }: { owedCents: number }) {
  if (owedCents <= 0) return null
  const fmt = (n: number) => new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(n)
  return (
    <p className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-warning/40 bg-warning/10 px-3 py-2 text-sm font-semibold text-warning">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      Already owes {fmt(owedCents)}
    </p>
  )
}