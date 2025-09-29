#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const OPENAI_MODELS_API_URL = 'https://api.openai.com/v1/models?limit=1000'
const CONTROLLER_TIMEOUT_MS = 30000

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..')
const OUTPUT_PATH = path.join(REPO_ROOT, 'server', 'openai-models.json')

const inferFamily = id => {
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

const normalizeModel = model => {
  if (!model || typeof model !== 'object') {
    return null
  }

  const id = typeof model.id === 'string' ? model.id.trim() : ''

  if (!id) {
    return null
  }

  const normalized = { id, name: id, provider: 'openai' }
  const family = inferFamily(id)

  if (family) {
    normalized.family = family
  }

  if (Number.isFinite(model.created)) {
    normalized.updated_at = new Date(model.created * 1000).toISOString()
  }

  return normalized
}

const dedupeById = models => {
  const seen = new Set()
  return models.filter(model => {
    if (!model || !model.id || seen.has(model.id)) {
      return false
    }
    seen.add(model.id)
    return true
  })
}

const sortById = models => models.slice().sort((a, b) => a.id.localeCompare(b.id))

const loadExistingSnapshot = () => {
  try {
    const raw = fs.readFileSync(OUTPUT_PATH, 'utf-8')
    const snapshot = JSON.parse(raw)
    if (!snapshot || typeof snapshot !== 'object') {
      return { models: [] }
    }
    const models = Array.isArray(snapshot.models) ? snapshot.models : []
    return { ...snapshot, models }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('Unable to read existing OpenAI catalog snapshot, continuing with a fresh refresh.', error)
    }
    return { models: [] }
  }
}

const mergeModelMetadata = (model, existing) => {
  if (!existing) {
    return model
  }

  const merged = { ...model }

  if (typeof existing.name === 'string' && existing.name.trim() && existing.name !== existing.id) {
    merged.name = existing.name.trim()
  }

  if (typeof existing.family === 'string' && existing.family.trim()) {
    merged.family = existing.family.trim()
  }

  if (existing.capabilities && typeof existing.capabilities === 'object') {
    merged.capabilities = { ...existing.capabilities }
  }

  if (Object.prototype.hasOwnProperty.call(existing, 'context_length')) {
    merged.context_length = existing.context_length
  }

  if (typeof existing.updated_at === 'string' && !merged.updated_at) {
    merged.updated_at = existing.updated_at
  }

  if (existing.metadata && typeof existing.metadata === 'object') {
    merged.metadata = { ...existing.metadata }
  }

  return merged
}

const isManualModel = model => Boolean(model?.metadata?.manual)

const mergeWithExistingEntries = (models, existingModels) => {
  const merged = [...models]
  const seen = new Set(merged.map(model => model.id))

  for (const existing of existingModels) {
    if (!existing || typeof existing !== 'object') {
      continue
    }

    const id = typeof existing.id === 'string' ? existing.id : ''
    if (!id || seen.has(id)) {
      continue
    }

    if (isManualModel(existing)) {
      merged.push(existing)
      seen.add(id)
    }
  }

  return sortById(merged)
}

const sanitizeSnapshotMetadata = metadata => {
  if (!metadata || typeof metadata !== 'object') {
    return {}
  }

  return Object.entries(metadata).reduce((accumulator, [key, value]) => {
    if (
      key === 'curated_through' ||
      key === 'curated_total' ||
      key === 'cache' ||
      key === 'total' ||
      key === 'fetched_at' ||
      key === 'fetched_via' ||
      key === 'source'
    ) {
      return accumulator
    }

    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
      accumulator[key] = value
    }

    return accumulator
  }, {})
}

const main = async () => {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    console.error('OPENAI_API_KEY is required to refresh the model catalog.')
    process.exitCode = 1
    return
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), CONTROLLER_TIMEOUT_MS)

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
      console.error(`Failed to fetch OpenAI models. Status: ${response.status}. Body: ${errorText}`)
      process.exitCode = 1
      return
    }

    const payload = await response.json()
    const existingSnapshot = loadExistingSnapshot()
    const existingModels = existingSnapshot.models
    const existingById = new Map(existingModels.map(model => [model.id, model]))
    const normalizedModels = dedupeById(
      sortById(
        (Array.isArray(payload?.data) ? payload.data : [])
          .map(normalizeModel)
          .filter(Boolean)
          .map(model => mergeModelMetadata(model, existingById.get(model.id)))
      )
    )

    if (normalizedModels.length === 0) {
      console.error('OpenAI API returned no models. Aborting refresh.')
      process.exitCode = 1
      return
    }

    const mergedModels = mergeWithExistingEntries(normalizedModels, existingModels)

    const existingMetadata =
      existingSnapshot.metadata && typeof existingSnapshot.metadata === 'object'
        ? existingSnapshot.metadata
        : {}

    const sanitizedMetadata = sanitizeSnapshotMetadata(existingMetadata)

    const snapshot = {
      provider: 'openai',
      models: mergedModels,
      fetched_at: new Date().toISOString(),
      fetched_via: 'api',
      metadata: {
        ...sanitizedMetadata,
        source: OPENAI_MODELS_API_URL,
        total: mergedModels.length,
        preserved_manual: mergedModels.length - normalizedModels.length
      }
    }

    fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`)
    console.log(
      `Updated ${OUTPUT_PATH} with ${mergedModels.length} models (${normalizedModels.length} from API, ${snapshot.metadata.preserved_manual} preserved manual entries).`
    )
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('The OpenAI model request timed out.')
    } else {
      console.error('Failed to refresh the OpenAI model catalog.', error)
    }
    process.exitCode = 1
  } finally {
    clearTimeout(timeout)
  }
}

await main()
