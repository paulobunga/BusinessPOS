import { getAiConfig, saveAiConfig } from '../ai/config.js'
import type { AiConfig } from '../../shared/types.js'

export const aiConfigService = {
  get(): AiConfig {
    return getAiConfig()
  },
  save(payload: { apiKey?: string; model: string }) {
    saveAiConfig(payload)
  },
}