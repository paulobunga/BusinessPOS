import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { getAiConfig, saveAiConfig, clearApiKey } from '../config'

const { store, fakeSafeStorage, fakeSettingsRepo } = vi.hoisted(() => {
  const internalStore = new Map<string, string>()
  return {
    store: internalStore,
    fakeSafeStorage: {
      isEncryptionAvailable: () => true as boolean,
      encryptString: (plain: string) => Buffer.from('ENC:' + plain),
      decryptString: (buf: Buffer) => buf.toString().replace(/^ENC:/, ''),
    },
    fakeSettingsRepo: {
      get: (key: string) => internalStore.get(key) ?? null,
      set: (key: string, value: string) => void internalStore.set(key, value),
    },
  }
})

vi.mock('electron', () => ({ safeStorage: fakeSafeStorage }))
vi.mock('../../db/repositories/settingsRepo.js', () => ({ settingsRepo: fakeSettingsRepo }))

describe('ai config', () => {
  beforeEach(() => {
    store.clear()
    vi.stubEnv('DEEPSEEK_API_KEY', '')
  })

  afterEach(() => vi.unstubAllEnvs())

  test('getAiConfig returns null key + default model when unset', () => {
    expect(getAiConfig()).toEqual({ apiKey: null, model: 'deepseek-flash' })
  })

  test('falls back to DEEPSEEK_API_KEY env when not stored', () => {
    vi.stubEnv('DEEPSEEK_API_KEY', 'sk-from-env')
    expect(getAiConfig()).toEqual({ apiKey: 'sk-from-env', model: 'deepseek-flash' })
  })

  test('saved key takes precedence over env', () => {
    vi.stubEnv('DEEPSEEK_API_KEY', 'sk-from-env')
    saveAiConfig({ apiKey: 'sk-stored-123', model: 'deepseek-flash' })
    expect(getAiConfig()).toEqual({ apiKey: 'sk-stored-123', model: 'deepseek-flash' })
  })

  test('saveAiConfig encrypts key and getAiConfig decrypts it', () => {
    saveAiConfig({ apiKey: 'sk-deepseek-123', model: 'deepseek-flash' })
    const stored = store.get('ai.api_key')!
    expect(Buffer.from(stored, 'base64').toString()).toContain('ENC:')
    expect(stored).not.toContain('sk-deepseek-123')
    expect(getAiConfig()).toEqual({ apiKey: 'sk-deepseek-123', model: 'deepseek-flash' })
  })

  test('clearApiKey removes the stored key', () => {
    saveAiConfig({ apiKey: 'sk-x', model: 'deepseek-flash' })
    clearApiKey()
    expect(getAiConfig().apiKey).toBeNull()
  })

  test('saveAiConfig throws when encryption unavailable', () => {
    fakeSafeStorage.isEncryptionAvailable = () => false
    expect(() => saveAiConfig({ apiKey: 'sk-x', model: 'deepseek-flash' })).toThrow()
    fakeSafeStorage.isEncryptionAvailable = () => true
  })
})