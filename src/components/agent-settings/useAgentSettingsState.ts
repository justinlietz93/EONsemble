import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { useKV } from '@/hooks/useKV'
import type { AgentConfig, LLMProvider, ProviderSettings } from '@/types/agent'
import { DEFAULT_PROVIDER_SETTINGS } from '@/types/agent'
import {
  configureAgentClient,
  listOllamaModels,
  probeQdrant as probeQdrantClient
} from '@/lib/api/agentClient'
import type { AutonomousConfig } from '@/types/autonomous'
import { DEFAULT_AUTONOMOUS_CONFIG } from '@/types/autonomous'
import { fetchOpenAIModelIds, type FetchOpenAIModelOptions } from '@/lib/api/providers'

import {
  DEFAULT_AGENT_CONFIGS,
  MODEL_SUGGESTIONS,
  VALID_PROVIDERS,
  cloneAgentDefaults,
  cloneProviderDefaults,
  cloneAutonomousDefaults,
  normalizeBaseUrl
} from './defaults'

interface OpenRouterModel { id?: string | null; name?: string | null }
interface OpenRouterResponse {
  data?: OpenRouterModel[]
  models?: OpenRouterModel[]
  error?: { message?: string | null } | string | null
}

interface UseAgentSettingsStateOptions {
  onConfigChange?: (configs: AgentConfig[]) => void
  onAutonomousChange?: (config: AutonomousConfig) => void
}

export interface AgentSettingsState {
  agentConfigs: AgentConfig[]
  providerConfigs: ProviderSettings
  autonomousConfig: AutonomousConfig
  defaultReferer: string
  openAIModels: string[]
  openAILoading: boolean
  openAIError: string | null
  ollamaModels: string[]
  ollamaLoading: boolean
  ollamaError: string | null
  openRouterModels: string[]
  openRouterLoading: boolean
  openRouterError: string | null
  ollamaBaseUrl: string
  openRouterBaseUrl: string
  qdrantBaseUrl: string
  qdrantStatus: 'unknown' | 'ready' | 'error'
  qdrantLoading: boolean
  qdrantMessage: string | null
  probeQdrant: () => Promise<void>
  handleAgentConfigChange: <Field extends keyof AgentConfig>(
    agentId: string,
    field: Field,
    value: AgentConfig[Field]
  ) => void
  handleProviderConfigChange: <P extends keyof ProviderSettings>(
    provider: P,
    field: keyof ProviderSettings[P],
    value: ProviderSettings[P][keyof ProviderSettings[P]]
  ) => void
  handleAutonomousConfigChange: <Field extends keyof AutonomousConfig>(
    field: Field,
    value: AutonomousConfig[Field]
  ) => void
  fetchOpenAIModels: (options?: FetchOpenAIModelOptions) => Promise<void>
  fetchOllamaModels: () => Promise<void>
  fetchOpenRouterModels: () => Promise<void>
  resetToDefaults: () => void
  getModelOptions: (agent: AgentConfig) => string[]
  enrichModelOptions: (options: string[], currentModel: string) => string[]
}

export function useAgentSettingsState({
  onConfigChange,
  onAutonomousChange
}: UseAgentSettingsStateOptions): AgentSettingsState {
  const [agentConfigs, setAgentConfigs] = useKV<AgentConfig[]>(
    'agent-configs',
    cloneAgentDefaults
  )
  const [providerConfigs, setProviderConfigs] = useKV<ProviderSettings>(
    'provider-configs',
    cloneProviderDefaults
  )
  const [autonomousConfig, setAutonomousConfig] = useKV<AutonomousConfig>(
    'autonomous-config',
    cloneAutonomousDefaults
  )

  const [openAIModels, setOpenAIModels] = useState<string[]>([])
  const [openAILoading, setOpenAILoading] = useState(false)
  const [openAIError, setOpenAIError] = useState<string | null>(null)

  const [ollamaModels, setOllamaModels] = useState<string[]>([])
  const [ollamaLoading, setOllamaLoading] = useState(false)
  const [ollamaError, setOllamaError] = useState<string | null>(null)

  const [openRouterModels, setOpenRouterModels] = useState<string[]>([])
  const [openRouterLoading, setOpenRouterLoading] = useState(false)
  const [openRouterError, setOpenRouterError] = useState<string | null>(null)

  const [qdrantStatus, setQdrantStatus] = useState<'unknown' | 'ready' | 'error'>('unknown')
  const [qdrantLoading, setQdrantLoading] = useState(false)
  const [qdrantMessage, setQdrantMessage] = useState<string | null>(null)

  const defaultReferer = useMemo(() => {
    if (typeof window === 'undefined') {
      return 'http://localhost'
    }
    return window.location.origin
  }, [])

  const ensureAgentConfigs = useCallback(() => {
    if (!agentConfigs || agentConfigs.length === 0) {
      const defaults = cloneAgentDefaults()
      setAgentConfigs(defaults)
      onConfigChange?.(defaults)
      return
    }

    if (agentConfigs.some(config => !VALID_PROVIDERS.includes(config.provider as LLMProvider))) {
      const normalized = agentConfigs.map(config => {
        if (!VALID_PROVIDERS.includes(config.provider as LLMProvider)) {
          return { ...config, provider: 'openai' as LLMProvider }
        }
        return config
      })
      setAgentConfigs(normalized)
      onConfigChange?.(normalized)
    }
  }, [agentConfigs, onConfigChange, setAgentConfigs])

  useEffect(() => {
    ensureAgentConfigs()
  }, [ensureAgentConfigs])

  useEffect(() => {
    if (!providerConfigs) {
      const defaults = cloneProviderDefaults()
      setProviderConfigs(defaults)
    }
  }, [providerConfigs, setProviderConfigs])

  useEffect(() => {
    configureAgentClient(providerConfigs ?? cloneProviderDefaults())
  }, [providerConfigs])

  const ollamaBaseUrl = useMemo(() => {
    const fallback = DEFAULT_PROVIDER_SETTINGS.ollama.baseUrl ?? 'http://localhost:11434'
    return normalizeBaseUrl(providerConfigs?.ollama?.baseUrl, fallback)
  }, [providerConfigs?.ollama?.baseUrl])

  const openRouterBaseUrl = useMemo(() => {
    const fallback = DEFAULT_PROVIDER_SETTINGS.openrouter.baseUrl ?? 'https://openrouter.ai/api/v1'
    return normalizeBaseUrl(providerConfigs?.openrouter?.baseUrl, fallback)
  }, [providerConfigs?.openrouter?.baseUrl])

  const qdrantBaseUrl = useMemo(() => {
    const fallback = DEFAULT_PROVIDER_SETTINGS.qdrant?.baseUrl ?? 'http://localhost:6333'
    return normalizeBaseUrl(providerConfigs?.qdrant?.baseUrl, fallback)
  }, [providerConfigs?.qdrant?.baseUrl])

  const handleAgentConfigChange = useCallback(
    <Field extends keyof AgentConfig>(
      agentId: string,
      field: Field,
      value: AgentConfig[Field]
    ) => {
      const existing = agentConfigs ?? cloneAgentDefaults()
      const updatedConfigs = existing.map(config =>
        config.id === agentId ? { ...config, [field]: value } : config
      )
      setAgentConfigs(updatedConfigs)
      onConfigChange?.(updatedConfigs)
    },
    [agentConfigs, onConfigChange, setAgentConfigs]
  )

  const handleProviderConfigChange = useCallback(
    <P extends keyof ProviderSettings>(
      provider: P,
      field: keyof ProviderSettings[P],
      value: ProviderSettings[P][keyof ProviderSettings[P]]
    ) => {
      const existing = providerConfigs ?? cloneProviderDefaults()
      const providerConfig = existing[provider] ?? {}
      const sanitizedValue = typeof value === 'string' ? (value.trim() === '' ? undefined : value) : value
      const updatedProviderConfig = {
        ...providerConfig,
        [field]: sanitizedValue
      }
      const updatedConfigs = {
        ...existing,
        [provider]: updatedProviderConfig
      } as ProviderSettings
      setProviderConfigs(updatedConfigs)
    },
    [providerConfigs, setProviderConfigs]
  )

  const handleAutonomousConfigChange = useCallback(
    <Field extends keyof AutonomousConfig>(field: Field, value: AutonomousConfig[Field]) => {
      const current = autonomousConfig ?? DEFAULT_AUTONOMOUS_CONFIG

      let nextValue = value
      if (field === 'maxCycles') {
        const numeric = typeof value === 'number' ? value : Number(value)
        const sanitized = Number.isFinite(numeric) && numeric >= 0 ? Math.floor(numeric) : 0
        nextValue = sanitized as AutonomousConfig[Field]
      }

      const updatedConfig: AutonomousConfig = {
        ...current,
        [field]: nextValue
      }

      setAutonomousConfig(updatedConfig)
      onAutonomousChange?.(updatedConfig)
    },
    [autonomousConfig, onAutonomousChange, setAutonomousConfig]
  )

  const fetchOpenAIModels = useCallback(async (options?: FetchOpenAIModelOptions) => {
    setOpenAILoading(true)
    setOpenAIError(null)

    try {
      const models = await fetchOpenAIModelIds(options ?? {})
      setOpenAIModels(Array.from(new Set(models)))
    } catch (error) {
      console.error('Failed to fetch OpenAI models', error)
      setOpenAIError(error instanceof Error ? error.message : 'Failed to fetch OpenAI models')
    } finally {
      setOpenAILoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchOpenAIModels()
  }, [fetchOpenAIModels])

  const fetchOllamaModels = useCallback(async () => {
    setOllamaLoading(true)
    setOllamaError(null)

    try {
      configureAgentClient(providerConfigs ?? cloneProviderDefaults())
      const { models } = await listOllamaModels()
      setOllamaModels(models)
    } catch (error) {
      console.error('Failed to fetch Ollama models', error)
      setOllamaError(error instanceof Error ? error.message : 'Failed to fetch Ollama models')
    } finally {
      setOllamaLoading(false)
    }
  }, [providerConfigs])

  const fetchOpenRouterModels = useCallback(async () => {
    const apiKey = providerConfigs?.openrouter?.apiKey
    if (!apiKey) {
      setOpenRouterError('Set an API key to fetch OpenRouter models')
      return
    }

    setOpenRouterLoading(true)
    setOpenRouterError(null)

    try {
      const response = await fetch(`${openRouterBaseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': providerConfigs?.openrouter?.referer || defaultReferer,
          'X-Title': providerConfigs?.openrouter?.appName || 'Collaborative Physics Agents'
        }
      })

      if (!response.ok) {
        const message = `HTTP ${response.status} from OpenRouter`
        throw new Error(message)
      }

      const data = (await response.json()) as OpenRouterResponse
      const models = (data.data || data.models || [])
        .map(model => model.id || model.name || '')
        .map(value => value.trim())
        .filter(Boolean)
      setOpenRouterModels(models)
    } catch (error) {
      console.error('Failed to fetch OpenRouter models', error)
      setOpenRouterError(error instanceof Error ? error.message : 'Failed to fetch OpenRouter models')
    } finally {
      setOpenRouterLoading(false)
    }
  }, [defaultReferer, openRouterBaseUrl, providerConfigs?.openrouter])

  const probeQdrant = useCallback(async () => {
    setQdrantLoading(true)
    setQdrantMessage(null)

    try {
      configureAgentClient(providerConfigs ?? cloneProviderDefaults())
      const result = await probeQdrantClient()
      setQdrantStatus(result.status)
      setQdrantMessage(result.message)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reach Qdrant'
      console.error('Failed to probe Qdrant', error)
      setQdrantStatus('error')
      setQdrantMessage(message)
    } finally {
      setQdrantLoading(false)
    }
  }, [providerConfigs])

  useEffect(() => {
    if (providerConfigs?.ollama?.baseUrl) {
      void fetchOllamaModels()
    }
  }, [providerConfigs?.ollama?.baseUrl, fetchOllamaModels])

  useEffect(() => {
    if (providerConfigs?.openrouter?.apiKey) {
      void fetchOpenRouterModels()
    }
  }, [providerConfigs?.openrouter?.apiKey, fetchOpenRouterModels])

  useEffect(() => {
    if (providerConfigs?.qdrant?.baseUrl) {
      void probeQdrant()
    } else {
      setQdrantStatus('unknown')
      setQdrantMessage(null)
    }
  }, [providerConfigs?.qdrant?.baseUrl, probeQdrant])

  const resetToDefaults = useCallback(() => {
    const defaultAgents = cloneAgentDefaults()
    const defaultProviders = cloneProviderDefaults()
    const defaultAutonomous = cloneAutonomousDefaults()

    setAgentConfigs(defaultAgents)
    setProviderConfigs(defaultProviders)
    setAutonomousConfig(defaultAutonomous)

    onConfigChange?.(defaultAgents)
    onAutonomousChange?.(defaultAutonomous)
    toast.success('Agent configurations reset to defaults')
  }, [onAutonomousChange, onConfigChange, setAgentConfigs, setAutonomousConfig, setProviderConfigs])

  const getModelOptions = useCallback(
    (agent: AgentConfig) => {
      if (agent.provider === 'ollama') {
        return ollamaModels
      }
      if (agent.provider === 'openai') {
        return openAIModels.length > 0
          ? openAIModels
          : MODEL_SUGGESTIONS.openai || []
      }
      if (agent.provider === 'openrouter') {
        return openRouterModels.length > 0
          ? openRouterModels
          : MODEL_SUGGESTIONS.openrouter || []
      }
      return MODEL_SUGGESTIONS[agent.provider] || []
    },
    [ollamaModels, openAIModels, openRouterModels]
  )

  const enrichModelOptions = useCallback((options: string[], currentModel: string) => {
    const cleaned = options
      .map(option => option?.trim())
      .filter((option): option is string => Boolean(option))
    if (currentModel && !cleaned.includes(currentModel)) {
      cleaned.push(currentModel)
    }
    return Array.from(new Set(cleaned))
  }, [])

  return {
    agentConfigs: agentConfigs ?? DEFAULT_AGENT_CONFIGS,
    providerConfigs: providerConfigs ?? cloneProviderDefaults(),
    autonomousConfig: autonomousConfig ?? DEFAULT_AUTONOMOUS_CONFIG,
    defaultReferer,
    openAIModels,
    openAILoading,
    openAIError,
    ollamaModels,
    ollamaLoading,
    ollamaError,
    openRouterModels,
    openRouterLoading,
    openRouterError,
    ollamaBaseUrl,
    openRouterBaseUrl,
    qdrantBaseUrl,
    qdrantStatus,
    qdrantLoading,
    qdrantMessage,
    probeQdrant,
    handleAgentConfigChange,
    handleProviderConfigChange,
    handleAutonomousConfigChange,
    fetchOpenAIModels,
    fetchOllamaModels,
    fetchOpenRouterModels,
    resetToDefaults,
    getModelOptions,
    enrichModelOptions
  }
}
