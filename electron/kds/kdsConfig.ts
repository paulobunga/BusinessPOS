import os from 'node:os'
import { randomInt } from 'node:crypto'
import { settingsRepo } from '../db/repositories/settingsRepo'
export const DEFAULT_KDS_PORT = 3000
export const DEFAULT_ALERT_MINUTES = 10
export function isValidPort(n: unknown): boolean { return Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 65535 }
export function getKdsPort(): number {
  const raw = settingsRepo.get('kds_port')
  const n = raw == null ? NaN : Number(raw)
  return isValidPort(n) ? n : DEFAULT_KDS_PORT
}
export function getAlertMinutes(): number {
  const raw = settingsRepo.get('kds_alert_minutes')
  const n = raw == null ? NaN : Number(raw)
  return Number.isInteger(n) && n >= 1 && n <= 120 ? n : DEFAULT_ALERT_MINUTES
}
export function getKdsToken(): string { return settingsRepo.get('kds_token') ?? '' }
export function ensureKdsToken(): string {
  const existing = settingsRepo.get('kds_token')
  if (existing && existing.trim().length >= 4) return existing
  const token = String(randomInt(100000, 1000000))
  settingsRepo.set('kds_token', token)
  return token
}
export function getLanIPv4Addresses(): string[] {
  const out = new Set<string>()
  for (const nets of Object.values(os.networkInterfaces())) {
    for (const net of nets ?? []) {
      if (net.family === 'IPv4' && !net.internal && net.address) out.add(net.address)
    }
  }
  return [...out]
}
export function buildKitchenUrls(port: number): string[] {
  return getLanIPv4Addresses().map(ip => `http://${ip}:${port}/kitchen`)
}
