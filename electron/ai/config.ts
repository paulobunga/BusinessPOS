import { safeStorage } from 'electron'
import { existsSync } from 'fs'
import path from 'path'
import { settingsRepo } from '../db/repositories/settingsRepo.js'
import type { AiConfig } from '../../shared/types.js'

const envPath = path.join(process.cwd(), '.env')
if (existsSync(envPath)) process.loadEnvFile(envPath)

export const SUPPORTED_MODELS = ['deepseek-flash', 'deepseek-v4-pro'] as const
export const DEFAULT_MODEL = SUPPORTED_MODELS[0]
const KEY_SETTING = 'ai.api_key'
const MODEL_SETTING = 'ai.model'
const LEGACY_KEY_PREFIX = 'sk-or-'

function isSupportedModel(value: string): value is typeof SUPPORTED_MODELS[number] {
  return (SUPPORTED_MODELS as readonly string[]).includes(value)
}

function encode(value: string): string {
  return safeStorage.encryptString(value).toString('base64')
}

function decode(value: string): string {
  return safeStorage.decryptString(Buffer.from(value, 'base64')).toString()
}

function envApiKey(): string | null {
  const v = process.env.DEEPSEEK_API_KEY
  return v && v.trim() ? v.trim() : null
}

function isLegacyKey(key: string | null): boolean {
  return key !== null && key.startsWith(LEGACY_KEY_PREFIX)
}

function seedApiKeyFromEnv() {
  const envKey = envApiKey()
  if (envKey) {
    settingsRepo.set(KEY_SETTING, encode(envKey))
  }
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
  if (isLegacyKey(apiKey)) {
    apiKey = null
  }
  const resolvedKey = apiKey || envApiKey()
  if (!resolvedKey) {
    seedApiKeyFromEnv()
  }
  const storedModel = settingsRepo.get(MODEL_SETTING)
  const model = storedModel && isSupportedModel(storedModel) ? storedModel : DEFAULT_MODEL
  return {
    apiKey: resolvedKey || null,
    model,
  }
}

export function saveAiConfig(cfg: { apiKey?: string; model: string }) {
  if (!isSupportedModel(cfg.model)) {
    throw new Error(`Unsupported model "${cfg.model}". Supported: ${SUPPORTED_MODELS.join(', ')}`)
  }
  if (cfg.apiKey !== undefined) {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('OS encryption unavailable — cannot store the DeepSeek API key securely')
    }
    settingsRepo.set(KEY_SETTING, encode(cfg.apiKey))
  }
  settingsRepo.set(MODEL_SETTING, cfg.model)
}

export function clearApiKey() {
  settingsRepo.set(KEY_SETTING, '')
}