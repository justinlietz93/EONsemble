import type { ProviderSettings } from '@/types/agent'
const DEFAULT_TIMEOUT_MS = 30_000
const STREAM_DELIMITER = '\n'
type ChatRole = 'system' | 'user' | 'assistant'
export interface ChatMessage {
  role: ChatRole
  content: string
}
export interface AgentClientConfig {
  ollamaBaseUrl: string
  qdrantBaseUrl: string | null
  qdrantApiKey: string | null
}
export interface PostChatRequest {
  provider: 'ollama'
  model: string
  messages: ChatMessage[]
  stream?: boolean
  options?: Record<string, unknown>
  onChunk?: (text: string) => void
  signal?: AbortSignal
  timeoutMs?: number
}
export interface PostChatResult {
  text: string
}
export interface EmbedRequest {
  model: string
  input: string
  signal?: AbortSignal
  timeoutMs?: number
}
export interface EmbedResult {
  embedding: number[]
}
export interface QdrantProbeResult {
  status: 'ready' | 'error'
  message: string
  collections?: number
}
export interface ListModelsResult {
  models: string[]
}
export class AgentClientError extends Error {
  readonly status?: number
  readonly url?: string

  constructor(message: string, options?: { status?: number; url?: string; cause?: unknown }) {
    super(message)
    this.name = 'AgentClientError'
    this.status = options?.status
    this.url = options?.url
    if (options?.cause) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- align with Error.cause typing
      ;(this as any).cause = options.cause
    }
  }
}
let activeConfig: AgentClientConfig | null = null
const sanitizeBaseUrl = (value: string | undefined | null, fallback: string): string => {
  if (!value) {
    return fallback
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return fallback
  }
  return trimmed.replace(/\/+$/u, '')
}
const resolveEnv = (key: 'VITE_OLLAMA_BASE_URL' | 'VITE_QDRANT_BASE_URL'): string | undefined => {
  try {
    return (import.meta as ImportMeta | undefined)?.env?.[key]
  } catch {
    return undefined
  }
}
const DEFAULT_OLLAMA_BASE = sanitizeBaseUrl(
  resolveEnv('VITE_OLLAMA_BASE_URL'),
  'http://localhost:11434'
)
const DEFAULT_QDRANT_BASE = sanitizeBaseUrl(
  resolveEnv('VITE_QDRANT_BASE_URL'),
  'http://localhost:6333'
)
const getGlobalFetch = (): typeof fetch => {
  if (typeof fetch !== 'function') {
    throw new AgentClientError('Global fetch is unavailable in this environment')
  }
  return fetch
}
const ensureConfig = (settings?: ProviderSettings | null): AgentClientConfig => {
  if (settings || !activeConfig) {
    const ollamaBase = sanitizeBaseUrl(settings?.ollama?.baseUrl, DEFAULT_OLLAMA_BASE)
    const qdrantBase = sanitizeBaseUrl(settings?.qdrant?.baseUrl, DEFAULT_QDRANT_BASE)
    activeConfig = {
      ollamaBaseUrl: ollamaBase,
      qdrantBaseUrl: qdrantBase || null,
      qdrantApiKey: settings?.qdrant?.apiKey?.trim() || null
    }
  }
  return activeConfig!
}
export const configureAgentClient = (settings?: ProviderSettings | null): AgentClientConfig =>
  ensureConfig(settings)
export const getAgentClientConfig = (): AgentClientConfig => {
  if (!activeConfig) {
    activeConfig = ensureConfig()
  }
  return activeConfig
}
const bindAbortSignals = (controller: AbortController, external?: AbortSignal): void => {
  if (!external) {
    return
  }
  if (external.aborted) {
    controller.abort()
    return
  }
  const abort = (): void => controller.abort()
  external.addEventListener('abort', abort, { once: true })
}
const withTimeout = async <T>(
  action: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  externalSignal?: AbortSignal
): Promise<T> => {
  const controller = new AbortController()
  bindAbortSignals(controller, externalSignal)
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await action(controller.signal)
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') {
      throw new AgentClientError('Request timed out', { cause: error })
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null
const extractOllamaMessageCandidate = (payload: unknown): string | unknown[] | null => {
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
const flattenOllamaSegments = (segments: unknown[]): string =>
  segments
    .map(segment => {
      if (typeof segment === 'string') {
        return segment
      }
      if (isRecord(segment) && typeof segment.text === 'string') {
        return segment.text
      }
      return ''
    })
    .join('')
const parseOllamaContent = (payload: unknown): string | null => {
  const candidate = extractOllamaMessageCandidate(payload)
  if (typeof candidate === 'string') {
    return candidate
  }
  if (Array.isArray(candidate)) {
    return flattenOllamaSegments(candidate)
  }
  return null
}
const parseOllamaError = (payload: unknown, status: number): string => {
  if (!isRecord(payload)) {
    return `HTTP ${status}`
  }
  const error = payload.error ?? payload.message
  if (typeof error === 'string') {
    return error
  }
  return `HTTP ${status}`
}
const decodeStreamLines = async (
  body: ReadableStream<Uint8Array>,
  onChunk?: (text: string) => void
): Promise<string> => {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) {
      break
    }
    buffer += decoder.decode(value, { stream: true })

    while (true) {
      const delimiterIndex = buffer.indexOf(STREAM_DELIMITER)
      if (delimiterIndex === -1) {
        break
      }
      const rawChunk = buffer.slice(0, delimiterIndex).trim()
      buffer = buffer.slice(delimiterIndex + STREAM_DELIMITER.length)
      if (!rawChunk) {
        continue
      }
      try {
        const parsed = JSON.parse(rawChunk) as Record<string, unknown>
        const content = parseOllamaContent(parsed)
        if (content) {
          result += content
          onChunk?.(content)
        }
      } catch {
        // ignore malformed segments and continue streaming
      }
    }
  }

  if (buffer.trim().length > 0) {
    try {
      const parsed = JSON.parse(buffer) as Record<string, unknown>
      const content = parseOllamaContent(parsed)
      if (content) {
        result += content
        onChunk?.(content)
      }
    } catch {
      // ignore trailing noise
    }
  }

  return result
}

export const postChat = async ({
  provider,
  model,
  messages,
  stream = false,
  options,
  onChunk,
  signal,
  timeoutMs = DEFAULT_TIMEOUT_MS
}: PostChatRequest): Promise<PostChatResult> => {
  const config = getAgentClientConfig()

  if (provider !== 'ollama') {
    throw new AgentClientError(`Unsupported provider: ${provider}`)
  }

  const fetchImpl = getGlobalFetch()
  const url = `${config.ollamaBaseUrl}/api/chat`

  return withTimeout<PostChatResult>(
    async controllerSignal => {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages,
          stream,
          options
        }),
        signal: controllerSignal
      })

      if (stream) {
        const body = response.body
        if (!body) {
          throw new AgentClientError('Streaming response body was empty', {
            status: response.status,
            url
          })
        }
        const text = await decodeStreamLines(body, onChunk)
        if (!response.ok) {
          throw new AgentClientError('Streaming request failed', {
            status: response.status,
            url
          })
        }
        return { text }
      }

      const payload = await response
        .json()
        .catch(error => {
          throw new AgentClientError(
            `Failed to parse provider response (HTTP ${response.status})`,
            { status: response.status, url, cause: error }
          )
        })

      if (!response.ok) {
        throw new AgentClientError(parseOllamaError(payload, response.status), {
          status: response.status,
          url
        })
      }

      const content = parseOllamaContent(payload)
      if (!content) {
        throw new AgentClientError('Provider response did not contain assistant content', {
          status: response.status,
          url
        })
      }

      return { text: content }
    },
    timeoutMs,
    signal
  )
}

export const embed = async ({
  model,
  input,
  signal,
  timeoutMs = DEFAULT_TIMEOUT_MS
}: EmbedRequest): Promise<EmbedResult> => {
  const config = getAgentClientConfig()
  const fetchImpl = getGlobalFetch()
  const url = `${config.ollamaBaseUrl}/api/embeddings`

  return withTimeout<EmbedResult>(
    async controllerSignal => {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          prompt: input
        }),
        signal: controllerSignal
      })

      const payload = await response
        .json()
        .catch(error => {
          throw new AgentClientError(
            `Failed to parse embedding response (HTTP ${response.status})`,
            { status: response.status, url, cause: error }
          )
        })

      if (!response.ok) {
        throw new AgentClientError(parseOllamaError(payload, response.status), {
          status: response.status,
          url
        })
      }

      if (!isRecord(payload) || !Array.isArray(payload.embedding)) {
        throw new AgentClientError('Embedding response did not include an embedding array', {
          status: response.status,
          url
        })
      }

      return {
        embedding: payload.embedding.map(value => Number(value))
      }
    },
    timeoutMs,
    signal
  )
}

export const listOllamaModels = async (): Promise<ListModelsResult> => {
  const config = getAgentClientConfig()
  const fetchImpl = getGlobalFetch()
  const url = `${config.ollamaBaseUrl}/api/tags`

  const response = await fetchImpl(url, { method: 'GET' })
  const payload = await response
    .json()
    .catch(error => {
      throw new AgentClientError(
        `Failed to parse Ollama models response (HTTP ${response.status})`,
        { status: response.status, url, cause: error }
      )
    })

  if (!response.ok) {
    throw new AgentClientError(parseOllamaError(payload, response.status), {
      status: response.status,
      url
    })
  }

  if (!isRecord(payload) || !Array.isArray(payload.models)) {
    return { models: [] }
  }

  const models = payload.models
    .map(model => {
      if (!isRecord(model)) {
        return null
      }
      const name = model.name
      return typeof name === 'string' ? name.trim() : null
    })
    .filter((name): name is string => Boolean(name))

  return { models }
}

export const probeQdrant = async (): Promise<QdrantProbeResult> => {
  const config = getAgentClientConfig()
  if (!config.qdrantBaseUrl) {
    return {
      status: 'error',
      message: 'Qdrant base URL is not configured'
    }
  }

  const fetchImpl = getGlobalFetch()
  const url = `${config.qdrantBaseUrl}/collections`
  const headers: Record<string, string> = {}
  if (config.qdrantApiKey) {
    headers['api-key'] = config.qdrantApiKey
  }

  try {
    const response = await fetchImpl(url, { headers })
    const payload = await response
      .json()
      .catch(error => {
        throw new AgentClientError(
          `Failed to parse Qdrant response (HTTP ${response.status})`,
          { status: response.status, url, cause: error }
        )
      })

    if (!response.ok) {
      throw new AgentClientError(`HTTP ${response.status}`, { status: response.status, url })
    }

    const collections = Array.isArray((payload as { collections?: unknown[] }).collections)
      ? (payload as { collections: unknown[] }).collections.length
      : undefined

    return {
      status: 'ready',
      message:
        collections !== undefined
          ? `Detected ${collections} collections at ${config.qdrantBaseUrl}`
          : `Connected to ${config.qdrantBaseUrl}`,
      collections
    }
  } catch (error) {
    if (error instanceof AgentClientError) {
      return {
        status: 'error',
        message: error.message
      }
    }
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to reach Qdrant'
    }
  }
}

configureAgentClient()
