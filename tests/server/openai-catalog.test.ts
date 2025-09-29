import { afterEach, describe, expect, it, vi } from 'vitest'

const originalApiKey = process.env.OPENAI_API_KEY

const restoreEnv = () => {
  if (originalApiKey === undefined) {
    delete process.env.OPENAI_API_KEY
  } else {
    process.env.OPENAI_API_KEY = originalApiKey
  }
}

describe('openai catalog loader', () => {
  afterEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
    restoreEnv()
  })

  it('memoizes the bundled catalog and keeps models normalized', async () => {
    vi.resetModules()

    const { readBundledOpenAIModelCatalog } = await import('../../server/openai-catalog.cjs')

    const first = readBundledOpenAIModelCatalog()
    const second = readBundledOpenAIModelCatalog()

    expect(second).toBe(first)
    expect(first.metadata.cache).toBe('bundled')
    expect(first.metadata.total).toBe(first.models.length)
    expect(first.metadata.manual_entries).toBeGreaterThanOrEqual(1)

    const ids = first.models.map(model => model.id)
    expect(new Set(ids).size).toBe(ids.length)

    const isSorted = first.models.every((model, index, array) => index === 0 || array[index - 1].id <= model.id)
    expect(isSorted).toBe(true)
    expect(first.models.every(model => model.provider === 'openai')).toBe(true)

    const manualModel = first.models.find(model => model.id === 'o1-preview')
    expect(manualModel?.metadata?.manual).toBe(true)
    expect(manualModel?.capabilities?.reasoning).toBe(true)

    const embeddingModel = first.models.find(model => model.id === 'text-embedding-3-large')
    expect(embeddingModel?.capabilities?.embedding).toBe(true)
  })

  it('fails fast if the bundled catalog drops curated models or manual metadata', async () => {
    vi.resetModules()

    const { readBundledOpenAIModelCatalog } = await import('../../server/openai-catalog.cjs')

    const catalog = readBundledOpenAIModelCatalog()
    const ids = new Set(catalog.models.map(model => model.id))

    expect(catalog.models.length).toBeGreaterThanOrEqual(90)
    expect(catalog.metadata.total).toBe(catalog.models.length)

    const expectedGpt5Ids = [
      'gpt-5',
      'gpt-5-2025-08-07',
      'gpt-5-chat-latest',
      'gpt-5-mini',
      'gpt-5-mini-2025-08-07',
      'gpt-5-nano',
      'gpt-5-nano-2025-08-07'
    ]

    for (const modelId of expectedGpt5Ids) {
      expect(ids.has(modelId)).toBe(true)
    }

    const manualEntries = catalog.models.filter(model => model.metadata?.manual === true)
    expect(manualEntries.map(model => model.id)).toContain('o1-preview')
    expect(manualEntries.every(model => model.capabilities?.reasoning === true)).toBe(true)
    expect(catalog.metadata.manual_entries).toBe(manualEntries.length)
  })

  it('caches successful API loads until the TTL expires', async () => {
    vi.resetModules()
    process.env.OPENAI_API_KEY = 'test-key'

    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ id: 'gpt-4', created: 1000 }, { id: 'gpt-4', created: 900 }] }),
      text: async () => ''
    }))
    vi.stubGlobal('fetch', fetchMock)

    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_000)

    const { loadOpenAIModelCatalog } = await import('../../server/openai-catalog.cjs')

    const first = await loadOpenAIModelCatalog()
    const second = await loadOpenAIModelCatalog()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(second).toBe(first)
    expect(first.metadata.cache).toBe('live')
    expect(first.models).toHaveLength(1)
    expect(first.models[0]).toMatchObject({ id: 'gpt-4', family: 'gpt-4' })

    nowSpy.mockRestore()
  })

  it('refreshes the cached catalog once the TTL window elapses', async () => {
    vi.resetModules()
    process.env.OPENAI_API_KEY = 'test-key'

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: 'gpt-4', created: 1_000 }] }),
        text: async () => ''
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: 'gpt-4o', created: 2_000 }] }),
        text: async () => ''
      })

    vi.stubGlobal('fetch', fetchMock)

    let currentTime = 0
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => currentTime)

    const { loadOpenAIModelCatalog } = await import('../../server/openai-catalog.cjs')
    const { OPENAI_MODELS_CACHE_TTL_MS } = await import('../../server/constants.cjs')

    currentTime = 1_000
    const first = await loadOpenAIModelCatalog()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(first.models).toHaveLength(1)
    expect(first.models[0].id).toBe('gpt-4')

    currentTime = 1_000 + OPENAI_MODELS_CACHE_TTL_MS - 1
    const second = await loadOpenAIModelCatalog()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(second).toBe(first)

    currentTime = 1_000 + OPENAI_MODELS_CACHE_TTL_MS + 1
    const third = await loadOpenAIModelCatalog()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(third).not.toBe(first)
    expect(third.models).toHaveLength(1)
    expect(third.models[0].id).toBe('gpt-4o')

    nowSpy.mockRestore()
  })

  it('falls back to the bundled catalog when API refresh fails', async () => {
    vi.resetModules()
    process.env.OPENAI_API_KEY = 'test-key'

    const fetchMock = vi
      .fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
        text: async () => ''
      }))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
        text: async () => ''
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
        text: async () => 'server error'
      })

    vi.stubGlobal('fetch', fetchMock)

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const { loadOpenAIModelCatalog, readBundledOpenAIModelCatalog } = await import('../../server/openai-catalog.cjs')

    const bundled = readBundledOpenAIModelCatalog()
    const first = await loadOpenAIModelCatalog()
    expect(first).toEqual(bundled)

    const second = await loadOpenAIModelCatalog({ forceRefresh: true })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(second).toBe(bundled)

    warnSpy.mockRestore()
  })
})
