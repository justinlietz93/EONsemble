export type AgentName = 'Phys-Alpha' | 'Phys-Beta' | 'Phys-Gamma'

export type LLMProvider = 'spark' | 'openai' | 'openrouter' | 'ollama'

export interface AgentConfig {
  id: string
  name: AgentName
  role: string
  provider: LLMProvider
  model: string
  systemPrompt: string
  temperature: number
  maxTokens: number
  enabled: boolean
}

export interface SparkProviderSettings {
  baseUrl?: string
}

export interface OpenAIProviderSettings {
  apiKey?: string
  baseUrl?: string
  organization?: string
}

export interface OpenRouterProviderSettings {
  apiKey?: string
  baseUrl?: string
  referer?: string
  appName?: string
}

export interface OllamaProviderSettings {
  baseUrl?: string
}

export interface QdrantProviderSettings {
  baseUrl?: string
  apiKey?: string
  collection?: string
}

export interface ProviderSettings {
  spark: SparkProviderSettings
  openai: OpenAIProviderSettings
  openrouter: OpenRouterProviderSettings
  ollama: OllamaProviderSettings
  qdrant: QdrantProviderSettings
}

const sanitizeBaseUrl = (value: string | undefined, fallback: string): string => {
  if (!value) {
    return fallback
  }

  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return fallback
  }

  return trimmed.replace(/\/+$/u, '')
}

const resolveEnvBaseUrl = (key: 'VITE_OLLAMA_BASE_URL' | 'VITE_QDRANT_BASE_URL', fallback: string): string => {
  try {
    const envValue = (import.meta as ImportMeta | undefined)?.env?.[key]
    return sanitizeBaseUrl(envValue, fallback)
  } catch {
    return fallback
  }
}

const defaultOllamaBaseUrl = resolveEnvBaseUrl('VITE_OLLAMA_BASE_URL', 'http://localhost:11434')
const defaultQdrantBaseUrl = resolveEnvBaseUrl('VITE_QDRANT_BASE_URL', 'http://localhost:6333')

export const DEFAULT_PROVIDER_SETTINGS: ProviderSettings = {
  spark: {},
  openai: {
    baseUrl: 'https://api.openai.com/v1'
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    appName: 'Collaborative Physicist'
  },
  ollama: {
    baseUrl: defaultOllamaBaseUrl
  },
  qdrant: {
    baseUrl: defaultQdrantBaseUrl
  }
}
