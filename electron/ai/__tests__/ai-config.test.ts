import { describe, test, expect, vi, beforeEach } from 'vitest'
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
  beforeEach(() => store.clear())

  test('getAiConfig returns null key + default model when unset', () => {
    expect(getAiConfig()).toEqual({ apiKey: null, model: 'openai/gpt-4o-mini' })
  })

  test('saveAiConfig encrypts key and getAiConfig decrypts it', () => {
    saveAiConfig({ apiKey: 'sk-openrouter-123', model: 'anthropic/claude-3.5-sonnet' })
    const stored = store.get('ai.api_key')!
    expect(Buffer.from(stored, 'base64').toString()).toContain('ENC:')
    expect(stored).not.toContain('sk-openrouter-123')
    expect(getAiConfig()).toEqual({ apiKey: 'sk-openrouter-123', model: 'anthropic/claude-3.5-sonnet' })
  })

  test('clearApiKey removes the stored key', () => {
    saveAiConfig({ apiKey: 'sk-x', model: 'openai/gpt-4o-mini' })
    clearApiKey()
    expect(getAiConfig().apiKey).toBeNull()
  })

  test('saveAiConfig throws when encryption unavailable', () => {
    fakeSafeStorage.isEncryptionAvailable = () => false
    expect(() => saveAiConfig({ apiKey: 'sk-x', model: 'openai/gpt-4o-mini' })).toThrow()
    fakeSafeStorage.isEncryptionAvailable = () => true
  })
})