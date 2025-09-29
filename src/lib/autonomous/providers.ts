import { DEFAULT_PROVIDER_SETTINGS } from '@/types/agent'
import type { AgentConfig, ProviderSettings, LLMProvider } from '@/types/agent'

import type { ChatMessage } from './prompt-builders'
import { sparkRuntime } from './spark-runtime'

interface ChatRequestBody {
  model: string
  messages: ChatMessage[]
  temperature: number
  stream: false
  max_tokens?: number
}

interface OllamaSegment {
  text?: string
}

const OPENAI_REQUEST_TIMEOUT_MS = 30000

function normalizeProvider(provider: string | undefined): LLMProvider {
  if (!provider) {
    return 'spark'
  }

  if (provider === 'xai') {
    return 'openai'
  }

  const allowed: LLMProvider[] = ['spark', 'openai', 'openrouter', 'ollama']
  if (allowed.includes(provider as LLMProvider)) {
    return provider as LLMProvider
  }

  return 'openai'
}

function resolveBaseUrl(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim()
  const base = trimmed && trimmed.length > 0 ? trimmed : fallback
  return base.replace(/\/+$/u, '')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function extractChatError(payload: unknown, status: number): string {
  if (isRecord(payload)) {
    const { error } = payload
    if (typeof error === 'string') {
      return error
    }
    if (isRecord(error) && typeof error.message === 'string') {
      return error.message
    }
  }
  return `HTTP ${status}`
}

function extractChatContent(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null
  }
  const { choices } = payload as { choices?: unknown }
  if (!Array.isArray(choices) || choices.length === 0) {
    return null
  }
  const [firstChoice] = choices
  if (!isRecord(firstChoice)) {
    return null
  }
  const { message } = firstChoice as { message?: unknown }
  if (!isRecord(message)) {
    return null
  }
  const { content } = message as { content?: unknown }
  return typeof content === 'string' ? content : null
}

function extractOllamaMessageCandidate(payload: unknown): string | unknown[] | null {
  if (!isRecord(payload)) {
    return null
  }

  const { message, response } = payload

  if (typeof message === 'string') {
    return message
  }
  if (isRecord(message) && typeof message.content === 'string') {
    return message.content
  }
  if (Array.isArray(message)) {
    return message
  }

  if (typeof response === 'string') {
    return response
  }
  if (isRecord(response) && typeof response.content === 'string') {
    return response.content
  }
  if (Array.isArray(response)) {
    return response
  }

  return null
}

function flattenOllamaSegments(segments: unknown[]): string {
  return segments
    .map(segment => {
      if (typeof segment === 'string') {
        return segment
      }
      if (isRecord(segment) && typeof (segment as OllamaSegment).text === 'string') {
        return (segment as OllamaSegment).text as string
      }
      return ''
    })
    .join('')
}

function extractOllamaError(payload: unknown, status: number): string {
  if (!isRecord(payload)) {
    return `HTTP ${status}`
  }

  const error = payload.error ?? payload.message
  if (typeof error === 'string') {
    return error
  }

  return `HTTP ${status}`
}

export async function callProviderLLM(
  agentConfig: AgentConfig,
  providerConfigs: ProviderSettings | undefined,
  messages: ChatMessage[],
  textPrompt: string
): Promise<string> {
  const provider = normalizeProvider(agentConfig.provider)
  const configs = providerConfigs ?? DEFAULT_PROVIDER_SETTINGS

  switch (provider) {
    case 'openai':
      return callOpenAI(agentConfig, configs.openai, messages)
    case 'openrouter':
      return callOpenRouter(agentConfig, configs.openrouter, messages)
    case 'ollama':
      return callOllama(agentConfig, configs.ollama, messages)
    case 'spark':
    default:
      return callSpark(agentConfig, textPrompt)
  }
}

async function callSpark(agentConfig: AgentConfig, prompt: string): Promise<string> {
  if (!sparkRuntime?.llm) {
    throw new Error('Spark provider selected but the runtime LLM interface is unavailable')
  }
  const model = agentConfig.model || 'gpt-4o'
  return sparkRuntime.llm(prompt, model)
}

async function callOpenAI(
  agentConfig: AgentConfig,
  config: ProviderSettings['openai'],
  messages: ChatMessage[]
): Promise<string> {
  const apiKey = config?.apiKey?.trim()
  if (!apiKey) {
    throw new Error('OpenAI provider selected but no API key is configured')
  }

  const fallback = DEFAULT_PROVIDER_SETTINGS.openai?.baseUrl || 'https://api.openai.com/v1'
  const baseUrl = resolveBaseUrl(config?.baseUrl, fallback)
  const url = `${baseUrl}/chat/completions`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`
  }
  if (config?.organization) {
    headers['OpenAI-Organization'] = config.organization
  }

  const body: ChatRequestBody = {
    model: agentConfig.model || 'gpt-4o',
    messages,
    temperature: agentConfig.temperature ?? 0.7,
    stream: false
  }

  if (agentConfig.maxTokens && agentConfig.maxTokens > 0) {
    body.max_tokens = agentConfig.maxTokens
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined

  if (controller) {
    timeoutHandle = setTimeout(() => controller.abort(), OPENAI_REQUEST_TIMEOUT_MS)
  }

  let response: Response

  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller?.signal
    })
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') {
      throw new Error('Request to OpenAI timed out')
    }
    throw error
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
    }
  }

  const responseClone = typeof response.clone === 'function' ? response.clone() : null
  let payload: unknown

  try {
    payload = await response.json()
  } catch {
    let rawBody = '<unavailable>'
    try {
      rawBody = await (responseClone ?? response).text()
    } catch {
      rawBody = '<unavailable>'
    }
    throw new Error(
      `Failed to parse OpenAI response (HTTP ${response.status}):\nRaw response body:\n${rawBody}`
    )
  }

  if (!response.ok) {
    throw new Error(extractChatError(payload, response.status))
  }

  const content = extractChatContent(payload)
  if (!content) {
    throw new Error('OpenAI response did not contain assistant content')
  }

  return content
}

async function callOpenRouter(
  agentConfig: AgentConfig,
  config: ProviderSettings['openrouter'],
  messages: ChatMessage[]
): Promise<string> {
  const apiKey = config?.apiKey?.trim()
  if (!apiKey) {
    throw new Error('OpenRouter provider selected but no API key is configured')
  }

  const fallback = DEFAULT_PROVIDER_SETTINGS.openrouter?.baseUrl || 'https://openrouter.ai/api/v1'
  const baseUrl = resolveBaseUrl(config?.baseUrl, fallback)
  const url = `${baseUrl}/chat/completions`

  const defaultReferer = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'HTTP-Referer': config?.referer?.trim() || defaultReferer,
    'X-Title':
      config?.appName?.trim() || DEFAULT_PROVIDER_SETTINGS.openrouter?.appName || 'Collaborative Physicist'
  }

  const body: ChatRequestBody = {
    model: agentConfig.model || 'openrouter/auto',
    messages,
    temperature: agentConfig.temperature ?? 0.7,
    stream: false
  }

  if (agentConfig.maxTokens && agentConfig.maxTokens > 0) {
    body.max_tokens = agentConfig.maxTokens
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  })

  const payload = await response.json().catch(() => {
    throw new Error(`Failed to parse OpenRouter response (HTTP ${response.status})`)
  })

  if (!response.ok) {
    throw new Error(extractChatError(payload, response.status))
  }

  const content = extractChatContent(payload)
  if (!content) {
    throw new Error('OpenRouter response did not contain assistant content')
  }

  return content
}

async function callOllama(
  agentConfig: AgentConfig,
  config: ProviderSettings['ollama'],
  messages: ChatMessage[]
): Promise<string> {
  const fallback = DEFAULT_PROVIDER_SETTINGS.ollama?.baseUrl || 'http://localhost:11434'
  const baseUrl = resolveBaseUrl(config?.baseUrl, fallback)
  if (!baseUrl) {
    throw new Error('Ollama provider selected but no base URL is configured')
  }

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: agentConfig.model || 'llama3.2',
      messages,
      stream: false,
      options: {
        temperature: agentConfig.temperature ?? 0.7,
        ...(agentConfig.maxTokens && agentConfig.maxTokens > 0
          ? { num_predict: agentConfig.maxTokens }
          : {})
      }
    })
  })

  const payload = await response.json().catch(() => {
    throw new Error(`Failed to parse Ollama response (HTTP ${response.status})`)
  })

  if (!response.ok) {
    throw new Error(extractOllamaError(payload, response.status))
  }

  const candidate = extractOllamaMessageCandidate(payload)
  if (typeof candidate === 'string') {
    return candidate
  }

  if (Array.isArray(candidate)) {
    return flattenOllamaSegments(candidate)
  }

  throw new Error('Ollama response did not contain assistant content')
}
