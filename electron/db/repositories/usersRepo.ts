import { getDb } from '../index.js'
import crypto from 'crypto'
import type { Role, User } from '../../../shared/types'

function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex')
}

export const usersRepo = {
  get(id: number): User | undefined {
    return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined
  },
  list(): User[] {
    return getDb().prepare('SELECT * FROM users ORDER BY id').all() as User[]
  },
  findByPin(pin: string) {
    return getDb().prepare('SELECT * FROM users WHERE pin_hash = ? AND active = 1').get(hashPin(pin))
  },
  countActiveAdmins(): number {
    return (getDb().prepare("SELECT COUNT(*) as c FROM users WHERE role = 'admin' AND active = 1").get() as { c: number }).c
  },
  create(name: string, role: Role, pin: string): User {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('Name is required')
    if (!/^\d{4}$/.test(pin)) throw new Error('PIN must be 4 digits')
    const info = getDb().prepare('INSERT INTO users (name, role, pin_hash) VALUES (?, ?, ?)').run(trimmed, role, hashPin(pin))
    return this.get(Number(info.lastInsertRowid)) as User
  },
  resetPin(id: number, newPin: string): boolean {
    if (!/^\d{4}$/.test(newPin)) throw new Error('PIN must be 4 digits')
    return getDb().prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(hashPin(newPin), id).changes > 0
  },
  update(id: number, changes: { name?: string; role?: Role; active?: number }): User | null {
    const existing = this.get(id)
    if (!existing) return null
    const nextRole = changes.role ?? existing.role
    const nextActive = changes.active ?? existing.active
    const demoteOrDeactivate =
      existing.role === 'admin' && (nextRole !== 'admin' || nextActive === 0)
    if (demoteOrDeactivate && this.countActiveAdmins() <= 1) {
      throw new Error('Cannot remove the last admin')
    }
    getDb().prepare('UPDATE users SET name = ?, role = ?, active = ? WHERE id = ?')
      .run(changes.name?.trim() || existing.name, nextRole, nextActive, id)
    return this.get(id) as User
  },
  setPin(userId: number, oldPin: string, newPin: string): boolean {
    const user = getDb().prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(userId) as { pin_hash: string } | undefined
    if (!user) return false
    if (user.pin_hash !== hashPin(oldPin)) return false
    getDb().prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(hashPin(newPin), userId)
    return true
  },
  seed(): void {
    const count = getDb().prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }
    if (count.c === 0) this.create('Admin', 'admin', '1234')
  }
}