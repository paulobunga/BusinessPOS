export type PrintKind = 'kot' | 'receipt'
export interface PrintRequest { orderId: number; kind: PrintKind }
export interface PrintResult { ok: boolean; skipped?: string; error?: string }
export interface PrinterInfo { name: string; isDefault: boolean }
