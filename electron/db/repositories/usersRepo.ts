import { getDb } from '../index.js'
import crypto from 'crypto'

function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex')
}

export const usersRepo = {
  findByPin(pin: string) {
    return getDb().prepare('SELECT * FROM users WHERE pin_hash = ? AND active = 1').get(hashPin(pin))
  },
  create(name: string, role: 'cashier' | 'manager', pin: string) {
    const result = getDb().prepare('INSERT INTO users (name, role, pin_hash) VALUES (?, ?, ?)').run(name, role, hashPin(pin))
    return { id: result.lastInsertRowid, name, role }
  },
  setPin(userId: number, oldPin: string, newPin: string): boolean {
    const user = getDb().prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(userId) as { pin_hash: string } | undefined
    if (!user) return false
    if (user.pin_hash !== hashPin(oldPin)) return false
    getDb().prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(hashPin(newPin), userId)
    return true
  },
  seed() {
    const count = getDb().prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }
    if (count.c === 0) {
      this.create('Manager', 'manager', '1234')
    }
  }
}