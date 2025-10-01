import '@testing-library/jest-dom/vitest'

import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { ProviderSettings } from '@/types/agent'

const persistedStore = vi.hoisted(() => new Map<string, unknown>()) as Map<string, unknown>

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn()
  }
}))

let AgentSettings: typeof import('@/components/AgentSettings').AgentSettings
let getAgentClientConfig: typeof import('@/lib/api/agentClient').getAgentClientConfig
let listOllamaModelsMock: ReturnType<typeof vi.fn>
let probeQdrantMock: ReturnType<typeof vi.fn>
let fetchOpenAIModelIdsMock: ReturnType<typeof vi.fn>
let fetchPersistedValueMock: ReturnType<typeof vi.fn>
let savePersistedValueMock: ReturnType<typeof vi.fn>
let removePersistedValueMock: ReturnType<typeof vi.fn>

const findPersistedSnapshot = (predicate: (value: ProviderSettings) => boolean): ProviderSettings | null => {
  const calls = savePersistedValueMock?.mock?.calls ?? []
  for (let index = calls.length - 1; index >= 0; index -= 1) {
    const [key, value] = calls[index] ?? []
    if (key === 'provider-configs' && value && predicate(value as ProviderSettings)) {
      return value as ProviderSettings
    }
  }
  return null
}

beforeAll(async () => {
  const agentClientModule = await import('@/lib/api/agentClient')
  getAgentClientConfig = agentClientModule.getAgentClientConfig
  listOllamaModelsMock = vi.spyOn(agentClientModule, 'listOllamaModels')
  probeQdrantMock = vi.spyOn(agentClientModule, 'probeQdrant')

  const providersModule = await import('@/lib/api/providers')
  fetchOpenAIModelIdsMock = vi.spyOn(providersModule, 'fetchOpenAIModelIds')

  const persistenceModule = await import('@/lib/api/persistence')
  fetchPersistedValueMock = vi
    .spyOn(persistenceModule, 'fetchPersistedValue')
    .mockImplementation(async (key: string) =>
      persistedStore.has(key) ? persistedStore.get(key) : undefined
    )
  savePersistedValueMock = vi
    .spyOn(persistenceModule, 'savePersistedValue')
    .mockImplementation(async (key: string, value: unknown) => {
      persistedStore.set(key, value)
    })
  removePersistedValueMock = vi
    .spyOn(persistenceModule, 'removePersistedValue')
    .mockImplementation(async (key: string) => {
      persistedStore.delete(key)
    })

  AgentSettings = (await import('@/components/AgentSettings')).AgentSettings
})

describe('AgentSettings provider persistence', () => {
  let originalLocalStorageDescriptor: PropertyDescriptor | undefined
  let originalSessionStorageDescriptor: PropertyDescriptor | undefined

  beforeEach(() => {
    originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')
    originalSessionStorageDescriptor = Object.getOwnPropertyDescriptor(window, 'sessionStorage')

    persistedStore.clear()
    listOllamaModelsMock.mockReset()
    probeQdrantMock.mockReset()
    fetchOpenAIModelIdsMock.mockReset()
    fetchPersistedValueMock.mockClear()
    savePersistedValueMock.mockClear()
    removePersistedValueMock.mockClear()

    listOllamaModelsMock.mockResolvedValue({ models: [] })
    probeQdrantMock.mockResolvedValue({
      status: 'ready',
      message: 'Connected to https://qdrant.remote:6333',
      collections: 2
    })
    fetchOpenAIModelIdsMock.mockResolvedValue([])

    const storageFactory = () => {
      let store: Record<string, string> = {}
      return {
        getItem: vi.fn((key: string) => store[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
          store[key] = value
        }),
        removeItem: vi.fn((key: string) => {
          delete store[key]
        }),
        clear: vi.fn(() => {
          store = {}
        })
      }
    }

    Object.defineProperty(window, 'localStorage', {
      value: storageFactory(),
      configurable: true
    })

    Object.defineProperty(window, 'sessionStorage', {
      value: storageFactory(),
      configurable: true
    })
  })

  afterEach(() => {
    if (originalLocalStorageDescriptor) {
      Object.defineProperty(window, 'localStorage', originalLocalStorageDescriptor)
    }
    if (originalSessionStorageDescriptor) {
      Object.defineProperty(window, 'sessionStorage', originalSessionStorageDescriptor)
    }

    vi.clearAllMocks()
  })

  it('persists Ollama base URL updates and configures the agent client with the normalized host', async () => {
    const user = userEvent.setup()

    render(<AgentSettings />)

    await user.click(screen.getByRole('tab', { name: /provider credentials/i }))

    const ollamaInput = screen.getByLabelText('Base URL', {
      selector: 'input#ollama-base-url'
    })

    await user.clear(ollamaInput)
    await user.type(ollamaInput, ' https://ollama.remote// ')
    await user.tab()

    await waitFor(() => {
      expect(
        findPersistedSnapshot(value => (value.ollama?.baseUrl ?? '').includes('ollama.remote'))
      ).not.toBeNull()
    })

    const persisted = findPersistedSnapshot(value =>
      (value.ollama?.baseUrl ?? '').includes('ollama.remote')
    )
    expect(persisted?.ollama?.baseUrl).toContain('ollama.remote')

    await waitFor(() => {
      expect(listOllamaModelsMock).toHaveBeenCalled()
    })

    expect(getAgentClientConfig().ollamaBaseUrl).toBe('https://ollama.remote')

    expect(
      screen.getByText('Watching https://ollama.remote for models.')
    ).toBeInTheDocument()
  })

  it('trims Qdrant credentials for probes and clears persistence when the fields are emptied', async () => {
    const user = userEvent.setup()

    render(<AgentSettings />)

    await user.click(screen.getByRole('tab', { name: /provider credentials/i }))

    const qdrantBaseInput = screen.getByLabelText('Base URL', {
      selector: 'input#qdrant-base-url'
    })
    const qdrantKeyInput = screen.getByLabelText('API Key (optional)', {
      selector: 'input#qdrant-api-key'
    })

    await user.clear(qdrantBaseInput)
    await user.type(qdrantBaseInput, ' https://qdrant.remote:6333/ ')
    await user.clear(qdrantKeyInput)
    await user.type(qdrantKeyInput, '  secret  ')
    await user.tab()

    await waitFor(() => {
      expect(
        findPersistedSnapshot(value => (value.qdrant?.baseUrl ?? '').includes('qdrant.remote'))
      ).not.toBeNull()
    })

    const qdrantPersisted = findPersistedSnapshot(value =>
      (value.qdrant?.baseUrl ?? '').includes('qdrant.remote')
    )
    expect(qdrantPersisted?.qdrant?.baseUrl).toContain('qdrant.remote')
    expect(qdrantPersisted?.qdrant?.apiKey).toContain('secret')

    await user.click(screen.getByRole('button', { name: /verify connection/i }))

    await waitFor(() => {
      expect(probeQdrantMock).toHaveBeenCalled()
    })

    const config = getAgentClientConfig()
    expect(config.qdrantBaseUrl).toBe('https://qdrant.remote:6333')
    expect(config.qdrantApiKey).toBe('secret')

    expect(
      screen.getByText('Connected to https://qdrant.remote:6333')
    ).toBeInTheDocument()

    await user.clear(qdrantBaseInput)
    await user.clear(qdrantKeyInput)
    await user.tab()

    await waitFor(() => {
      expect(
        findPersistedSnapshot(
          value => value.qdrant?.baseUrl === undefined && value.qdrant?.apiKey === undefined
        )
      ).not.toBeNull()
    })

    await waitFor(() => {
      expect(getAgentClientConfig().qdrantBaseUrl).toBe('http://localhost:6333')
    })

    expect(
      screen.getByText(
        'Set the base URL and optionally collection name to enable vector storage.'
      )
    ).toBeInTheDocument()
  })
})
