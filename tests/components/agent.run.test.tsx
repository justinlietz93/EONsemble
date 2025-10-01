import '@testing-library/jest-dom/vitest'

import { useState, type Dispatch, type SetStateAction } from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { AgentCollaboration } from '@/components/AgentCollaboration'
import type { AgentResponse, KnowledgeEntry, PhysicsGoal } from '@/App'
import type { KVUpdater } from '@/hooks/useKV'
import { DEFAULT_PROVIDER_SETTINGS } from '@/types/agent'

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn()
  }
}))

const kvStore = new Map<string, unknown>()

vi.mock('@/hooks/useKV', () => ({
  useKV: <T,>(key: string, initial: T) => {
    if (!kvStore.has(key)) {
      const resolvedInitial =
        typeof initial === 'function' ? (initial as () => T)() : (initial as T)
      kvStore.set(key, resolvedInitial)
    }

    const setValue = (updater: unknown) => {
      const current = kvStore.get(key)
      const next =
        typeof updater === 'function'
          ? (updater as (previous: unknown) => unknown)(current)
          : updater
      kvStore.set(key, next)
    }

    return [kvStore.get(key) as T, setValue] as const
  }
}))

const baseGoal: PhysicsGoal = {
  id: 'goal-1',
  title: 'Test Goal',
  description: 'Verify remote provider routing',
  domain: 'General',
  objectives: [],
  constraints: [],
  createdAt: new Date().toISOString()
}

const applyUpdater = <T,>(setState: Dispatch<SetStateAction<T>>) =>
  (updater: KVUpdater<T>) => {
    setState(previous =>
      typeof updater === 'function'
        ? (updater as (value: T) => T)(previous)
        : updater
    )
  }

function AgentCollaborationHarness({ goal }: { goal: PhysicsGoal }) {
  const [history, setHistory] = useState<AgentResponse[]>([])
  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([])

  return (
    <AgentCollaboration
      goal={goal}
      derivationHistory={history}
      setDerivationHistory={applyUpdater(setHistory)}
      knowledgeBase={knowledge}
      setKnowledgeBase={applyUpdater(setKnowledge)}
    />
  )
}

const remoteOllamaBase = 'https://ollama.remote.test'

beforeEach(() => {
  kvStore.clear()
  kvStore.set('agent-configs', [
    {
      id: 'agent-alpha',
      name: 'Phys-Alpha',
      role: 'Initiator',
      provider: 'ollama',
      model: 'llama3',
      systemPrompt: 'Respond succinctly',
      temperature: 0.1,
      maxTokens: 128,
      enabled: true
    }
  ])
  kvStore.set('autonomous-config', {
    enabled: false,
    continueOvernight: true,
    stopOnGammaDecision: false,
    maxCycles: 3
  })
  kvStore.set('provider-configs', {
    ...DEFAULT_PROVIDER_SETTINGS,
    ollama: {
      ...DEFAULT_PROVIDER_SETTINGS.ollama,
      baseUrl: remoteOllamaBase
    }
  })
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('AgentCollaboration run pipeline', () => {
  it('targets the configured Ollama base URL and renders model output', async () => {
    const user = userEvent.setup()

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url
      expect(url).toBe(`${remoteOllamaBase}/api/chat`)

      expect(init?.method).toBe('POST')
      const body = init?.body ? JSON.parse(init.body as string) : null
      expect(body?.model).toBe('llama3')

      return new Response(
        JSON.stringify({
          message: {
            content: 'Remote answer.\n<END_OF_RESPONSE>'
          }
        }),
        { status: 200 }
      )
    })

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    render(<AgentCollaborationHarness goal={baseGoal} />)

    await user.click(screen.getByRole('button', { name: /run turn/i }))

    expect(await screen.findByText(/Remote answer/)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      `${remoteOllamaBase}/api/chat`,
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('surfaces provider errors in the UI when the request fails', async () => {
    const user = userEvent.setup()

    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ error: 'model not found' }), { status: 500 })
    )

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    render(<AgentCollaborationHarness goal={baseGoal} />)

    await user.click(screen.getByRole('button', { name: /run turn/i }))

    expect(await screen.findByTestId('agent-run-error')).toHaveTextContent('model not found')
    expect(fetchMock).toHaveBeenCalled()
  })
})
