const fs = require('fs')

const {
  OPENAI_MODELS_API_URL,
  OPENAI_MODELS_CACHE_TTL_MS,
  OPENAI_MODELS_PATH
} = require('./constants.cjs')

let cachedOpenAIModelCatalog = null
let cachedOpenAIModelCatalogTimestamp = 0
let openAIModelFetchPromise = null
let bundledOpenAIModelCatalog = null

const RETRYABLE_NETWORK_ERROR_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNREFUSED'
])

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

const shouldRetryError = error => {
  if (!error || typeof error !== 'object') {
    return false
  }

  const code = error.code || (error.cause && error.cause.code)
  if (typeof code === 'string' && RETRYABLE_NETWORK_ERROR_CODES.has(code)) {
    return true
  }

  if (error.name === 'AbortError') {
    return true
  }

  const status = error.status || (error.response && error.response.status)
  if (typeof status === 'number') {
    return status >= 500 && status < 600
  }

  return false
}

const fetchWithRetry = async (fn, { retries = 2, baseDelay = 500 } = {}) => {
  let attempt = 0
  let delayMs = baseDelay

  while (true) {
    try {
      return await fn()
    } catch (error) {
      if (attempt >= retries || !shouldRetryError(error)) {
        throw error
      }

      await sleep(delayMs)
      attempt += 1
      delayMs *= 2
    }
  }
}

const inferOpenAIFamily = id => {
  if (!id) {
    return null
  }

  if (id.startsWith('gpt-4o-mini')) {
    return 'gpt-4o-mini'
  }

  if (id.startsWith('gpt-4o')) {
    return 'gpt-4o'
  }

  if (id.startsWith('gpt-4.1')) {
    return 'gpt-4.1'
  }

  if (id.startsWith('gpt-4')) {
    return 'gpt-4'
  }

  if (id.startsWith('gpt-3.5')) {
    return 'gpt-3.5'
  }

  if (id.startsWith('o1')) {
    return 'o1'
  }

  if (id.startsWith('o3')) {
    return 'o3'
  }

  if (id.startsWith('o4')) {
    return 'o4'
  }

  if (id.startsWith('omni')) {
    return 'omni'
  }

  if (id.includes('embedding')) {
    return 'text-embedding'
  }

  if (id.includes('whisper')) {
    return 'whisper'
  }

  if (id.includes('tts')) {
    return 'tts'
  }

  return null
}

const normalizeCapabilityMap = capabilities => {
  if (!capabilities || typeof capabilities !== 'object') {
    return null
  }

  const normalized = Object.entries(capabilities).reduce((accumulator, [key, value]) => {
    if (typeof value === 'boolean') {
      accumulator[key] = value
    }
    return accumulator
  }, {})

  return Object.keys(normalized).length > 0 ? normalized : null
}

const normalizeMetadataValue = value => {
  if (value === null) {
    return null
  }

  if (Array.isArray(value)) {
    const normalizedArray = value
      .map(entry => normalizeMetadataValue(entry))
      .filter(entry => entry !== undefined)

    return normalizedArray.length > 0 ? normalizedArray : undefined
  }

  if (typeof value === 'object') {
    const normalizedObject = Object.entries(value).reduce((accumulator, [key, nested]) => {
      const normalizedNested = normalizeMetadataValue(nested)

      if (normalizedNested !== undefined) {
        accumulator[key] = normalizedNested
      }

      return accumulator
    }, {})

    return Object.keys(normalizedObject).length > 0 ? normalizedObject : undefined
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  return undefined
}

const normalizeRecordMetadata = metadata => {
  if (!metadata || typeof metadata !== 'object') {
    return null
  }

  const normalizedEntries = Object.entries(metadata).reduce((accumulator, [key, value]) => {
    const normalizedValue = normalizeMetadataValue(value)

    if (normalizedValue !== undefined) {
      accumulator[key] = normalizedValue
    }

    return accumulator
  }, {})

  return Object.keys(normalizedEntries).length > 0 ? normalizedEntries : null
}

const normalizeStaticOpenAIModelRecord = record => {
  if (!record || typeof record !== 'object') {
    return null
  }

  const id = typeof record.id === 'string' ? record.id.trim() : typeof record.name === 'string' ? record.name.trim() : ''

  if (!id) {
    return null
  }

  const name = typeof record.name === 'string' && record.name.trim().length > 0 ? record.name.trim() : id
  const normalized = { id, name, provider: 'openai' }
  const family = typeof record.family === 'string' && record.family.trim().length > 0 ? record.family.trim() : inferOpenAIFamily(id)

  if (family) {
    normalized.family = family
  }

  if (Number.isFinite(record.context_length)) {
    normalized.context_length = record.context_length
  }

  const capabilities = normalizeCapabilityMap(record.capabilities)
  if (capabilities) {
    normalized.capabilities = capabilities
  }

  if (typeof record.updated_at === 'string' && record.updated_at.trim().length > 0) {
    normalized.updated_at = record.updated_at.trim()
  }

  const metadata = normalizeRecordMetadata(record.metadata)
  if (metadata) {
    normalized.metadata = metadata
  }

  return normalized
}

const normalizeApiOpenAIModelRecord = record => {
  if (!record || typeof record !== 'object') {
    return null
  }

  const id = typeof record.id === 'string' ? record.id.trim() : ''

  if (!id) {
    return null
  }

  const normalized = { id, name: id, provider: 'openai' }
  const family = inferOpenAIFamily(id)

  if (family) {
    normalized.family = family
  }

  if (Number.isFinite(record.created)) {
    try {
      normalized.updated_at = new Date(record.created * 1000).toISOString()
    } catch (error) {
      console.warn('Unable to convert OpenAI created timestamp', error)
    }
  }

  return normalized
}

const dedupeModelsById = models => {
  const seen = new Set()
  return models.filter(model => {
    if (!model || !model.id || seen.has(model.id)) {
      return false
    }
    seen.add(model.id)
    return true
  })
}

const sortModelsById = models => models.slice().sort((a, b) => a.id.localeCompare(b.id))

const readBundledOpenAIModelCatalog = () => {
  if (bundledOpenAIModelCatalog) {
    return bundledOpenAIModelCatalog
  }

  try {
    const raw = fs.readFileSync(OPENAI_MODELS_PATH, 'utf-8')
    const parsed = JSON.parse(raw)
    const models = Array.isArray(parsed.models) ? parsed.models : []
    const normalizedModels = dedupeModelsById(
      sortModelsById(
        models
          .map(normalizeStaticOpenAIModelRecord)
          .filter(model => model && typeof model.id === 'string')
      )
    )

    bundledOpenAIModelCatalog = {
      provider: 'openai',
      models: normalizedModels,
      fetched_at: typeof parsed.fetched_at === 'string' ? parsed.fetched_at : null,
      fetched_via: typeof parsed.fetched_via === 'string' ? parsed.fetched_via : 'static',
      metadata: {
        ...(parsed.metadata && typeof parsed.metadata === 'object' ? parsed.metadata : {}),
        cache: 'bundled',
        total: normalizedModels.length
      }
    }
  } catch (error) {
    console.error('Failed to load bundled OpenAI model catalog', error)
    bundledOpenAIModelCatalog = { provider: 'openai', models: [], metadata: { cache: 'bundled', total: 0 } }
  }

  return bundledOpenAIModelCatalog
}

const fetchOpenAIModelCatalogFromApi = async () => {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return null
  }

  const performFetch = async () => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)

    try {
      const response = await fetch(OPENAI_MODELS_API_URL, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        const error = new Error(`OpenAI model API responded with status ${response.status}`)
        error.status = response.status
        error.responseText = errorText
        throw error
      }

      const payload = await response.json()
      const rawModels = Array.isArray(payload?.data) ? payload.data : []
      const normalizedModels = dedupeModelsById(
        sortModelsById(
          rawModels.map(normalizeApiOpenAIModelRecord).filter(Boolean)
        )
      )

      if (normalizedModels.length === 0) {
        return null
      }

      return {
        provider: 'openai',
        models: normalizedModels,
        fetched_at: new Date().toISOString(),
        fetched_via: 'api',
        metadata: {
          source: OPENAI_MODELS_API_URL,
          total: normalizedModels.length,
          cache: 'live'
        }
      }
    } catch (error) {
      if (error && error.name === 'AbortError') {
        const timeoutError = new Error('OpenAI model API request timed out')
        timeoutError.name = 'AbortError'
        throw timeoutError
      }

      throw error
    } finally {
      clearTimeout(timeout)
    }
  }

  try {
    return await fetchWithRetry(performFetch, { retries: 2, baseDelay: 500 })
  } catch (error) {
    if (error && error.name === 'AbortError') {
      console.warn('OpenAI model API request timed out')
    } else if (typeof error?.status === 'number') {
      const details = typeof error.responseText === 'string' ? error.responseText : ''
      console.warn('OpenAI model API responded with a non-success status', error.status, details)
    } else {
      console.error('Failed to fetch OpenAI models from API', error)
    }
    return null
  }
}

const refreshOpenAIModelCatalog = async () => {
  const apiCatalog = await fetchOpenAIModelCatalogFromApi()

  if (apiCatalog) {
    cachedOpenAIModelCatalog = apiCatalog
    cachedOpenAIModelCatalogTimestamp = Date.now()
    return apiCatalog
  }

  const fallbackCatalog = readBundledOpenAIModelCatalog()
  cachedOpenAIModelCatalog = fallbackCatalog
  cachedOpenAIModelCatalogTimestamp = Date.now()
  return fallbackCatalog
}

const scheduleOpenAIModelRefresh = () => {
  const refreshPromise = refreshOpenAIModelCatalog()

  openAIModelFetchPromise = refreshPromise
  refreshPromise
    .catch(error => {
      console.error('OpenAI model catalog refresh failed', error)
      return readBundledOpenAIModelCatalog()
    })
    .finally(() => {
      if (openAIModelFetchPromise === refreshPromise) {
        openAIModelFetchPromise = null
      }
    })

  return refreshPromise
}

const loadOpenAIModelCatalog = async ({ forceRefresh = false } = {}) => {
  const now = Date.now()

  if (!forceRefresh && cachedOpenAIModelCatalog && now - cachedOpenAIModelCatalogTimestamp < OPENAI_MODELS_CACHE_TTL_MS) {
    return cachedOpenAIModelCatalog
  }

  if (!forceRefresh && openAIModelFetchPromise) {
    return openAIModelFetchPromise
  }

  return scheduleOpenAIModelRefresh()
}

module.exports = {
  loadOpenAIModelCatalog,
  readBundledOpenAIModelCatalog
}
