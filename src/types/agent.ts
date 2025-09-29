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

export interface ProviderSettings {
  spark: SparkProviderSettings
  openai: OpenAIProviderSettings
  openrouter: OpenRouterProviderSettings
  ollama: OllamaProviderSettings
}

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
    baseUrl: 'http://localhost:11434'
  }
}
