export function formatUGX(cents: number): string {
  return `UGX ${cents.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}