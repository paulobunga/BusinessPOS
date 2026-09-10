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
  seed() {
    const count = getDb().prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }
    if (count.c === 0) {
      this.create('Manager', 'manager', '1234')
    }
  }
}