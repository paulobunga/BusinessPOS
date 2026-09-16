import { safeStorage } from 'electron'
import { settingsRepo } from '../db/repositories/settingsRepo.js'
import type { AiConfig } from '../../shared/types.js'

export const DEFAULT_MODEL = 'openai/gpt-4o-mini'
const KEY_SETTING = 'ai.api_key'
const MODEL_SETTING = 'ai.model'

function encode(value: string): string {
  return safeStorage.encryptString(value).toString('base64')
}

function decode(value: string): string {
  return safeStorage.decryptString(Buffer.from(value, 'base64')).toString()
}

export function getAiConfig(): AiConfig {
  const encrypted = settingsRepo.get(KEY_SETTING)
  let apiKey: string | null = null
  if (encrypted) {
    try {
      apiKey = decode(encrypted)
    } catch {
      apiKey = null
    }
  }
  return { apiKey, model: settingsRepo.get(MODEL_SETTING) ?? DEFAULT_MODEL }
}

export function saveAiConfig(cfg: { apiKey?: string; model: string }) {
  if (cfg.apiKey !== undefined) {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('OS encryption unavailable — cannot store the OpenRouter API key securely')
    }
    settingsRepo.set(KEY_SETTING, encode(cfg.apiKey))
  }
  settingsRepo.set(MODEL_SETTING, cfg.model)
}

export function clearApiKey() {
  settingsRepo.set(KEY_SETTING, '')
}