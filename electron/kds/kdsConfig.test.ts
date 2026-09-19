import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../db/migrations/001_initial'

let db: Database.Database

vi.mock('../db/index', () => ({
  getDb: () => db,
}))

import { settingsRepo } from '../db/repositories/settingsRepo'
import {
  DEFAULT_KDS_PORT,
  DEFAULT_ALERT_MINUTES,
  isValidPort,
  getKdsPort,
  getAlertMinutes,
  getKdsToken,
  ensureKdsToken,
  getLanIPv4Addresses,
  buildKitchenUrls,
} from './kdsConfig'

describe('kdsConfig', () => {
  beforeAll(() => {
    db = new Database(':memory:')
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
  })

  afterAll(() => {
    db.close()
  })

  beforeEach(() => {
    db.prepare('DELETE FROM settings').run()
  })

  test('defaults are 3000/10', () => {
    expect(DEFAULT_KDS_PORT).toBe(3000)
    expect(DEFAULT_ALERT_MINUTES).toBe(10)
    expect(getKdsPort()).toBe(3000)
    expect(getAlertMinutes()).toBe(10)
  })

  test('token is 6-digit and stable', () => {
    const token = ensureKdsToken()
    expect(token).toMatch(/^\d{6}$/)
    expect(getKdsToken()).toBe(token)
    expect(ensureKdsToken()).toBe(token)
  })

  test('invalid port foo/0/99999 falls back to 3000', () => {
    for (const bad of ['foo', '0', '99999']) {
      settingsRepo.set('kds_port', bad)
      expect(getKdsPort()).toBe(3000)
    }
  })

  test('invalid minutes fall back to 10', () => {
    for (const bad of ['foo', '0', '999', '-5', '2.5']) {
      settingsRepo.set('kds_alert_minutes', bad)
      expect(getAlertMinutes()).toBe(10)
    }
  })

  test('isValidPort validates range', () => {
    expect(isValidPort(3000)).toBe(true)
    expect(isValidPort(1)).toBe(true)
    expect(isValidPort(65535)).toBe(true)
    expect(isValidPort(0)).toBe(false)
    expect(isValidPort(99999)).toBe(false)
    expect(isValidPort('foo')).toBe(false)
  })

  test('getLanIPv4Addresses returns string[]', () => {
    const addrs = getLanIPv4Addresses()
    expect(Array.isArray(addrs)).toBe(true)
    for (const ip of addrs) expect(typeof ip).toBe('string')
  })

  test('buildKitchenUrls(3000) entries match http://<ip>:3000/kitchen', () => {
    const urls = buildKitchenUrls(3000)
    expect(Array.isArray(urls)).toBe(true)
    const ips = getLanIPv4Addresses()
    expect(urls).toEqual(ips.map(ip => `http://${ip}:3000/kitchen`))
    for (const url of urls) {
      expect(url).toMatch(/^http:\/\/.*:3000\/kitchen$/)
    }
  })

  test('seed adds kds defaults but not token', () => {
    settingsRepo.seed()
    expect(settingsRepo.get('kds_port')).toBe('3000')
    expect(settingsRepo.get('kds_alert_minutes')).toBe('10')
    expect(settingsRepo.get('kds_token')).toBeNull()
  })
})
