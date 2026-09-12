import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Loader2 } from 'lucide-react'
import { cn } from 'cn'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  loading?: boolean
  className?: string
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  loading = false,
  className,
}: EmptyStateProps) {
  if (loading) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
          className
        )}
      >
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="m-0 text-[0.9375rem] font-semibold text-muted-foreground">{title}</p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 px-6 py-12 text-center',
        className
      )}
    >
      {Icon && (
        <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-7" />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <p className="m-0 text-[0.9375rem] font-bold">{title}</p>
        {description && <p className="m-0 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export { EmptyState }