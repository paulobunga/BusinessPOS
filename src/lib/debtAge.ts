export type AgeBucket = 'fresh' | 'warn' | 'overdue'

export function ageBucket(daysOpen: number): AgeBucket {
  if (daysOpen > 30) return 'overdue'
  if (daysOpen >= 7) return 'warn'
  return 'fresh'
}

export function formatAge(daysOpen: number): string {
  return daysOpen <= 0 ? 'Today' : `${daysOpen}d`
}