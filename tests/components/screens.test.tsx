import '@testing-library/jest-dom/vitest'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { KnowledgeGraph } from '@/components/KnowledgeGraph'
import { AgentSettings } from '@/components/AgentSettings'
import type { AgentResponse, KnowledgeEntry, PhysicsGoal } from '@/App'

class ResizeObserverMock implements ResizeObserver {
  observe(): void {
    return undefined
  }

  unobserve(): void {
    return undefined
  }

  disconnect(): void {
    return undefined
  }
}

const buildFetchMock = () =>
  vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    const method = init?.method ?? 'GET'

    if (url.includes('/api/state/')) {
      if (method === 'PUT') {
        const body = typeof init?.body === 'string' ? init.body : ''
        let value: unknown = null
        try {
          value = JSON.parse(body || '{}').value ?? null
        } catch {
          value = null
        }
        return new Response(JSON.stringify({ value }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ value: null }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (url.includes('/api/tags')) {
      return new Response(JSON.stringify({ models: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (url.includes('/api/openai/models')) {
      return new Response(JSON.stringify({ models: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (url.includes('/api/void/register')) {
      return new Response(JSON.stringify({ stats: {}, events: [], top: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response('{}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  })

describe('application screens', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal('fetch', buildFetchMock())
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('renders the knowledge graph without crashing', () => {
    const goals: PhysicsGoal[] = [
      {
        id: 'goal-1',
        title: 'Test Goal',
        description: 'Explore knowledge graph rendering.',
        domain: 'test',
        objectives: ['First objective'],
        constraints: ['First constraint'],
        createdAt: new Date().toISOString()
      }
    ]
    const knowledgeBase: KnowledgeEntry[] = [
      {
        id: 'kb-1',
        title: 'Sample Knowledge',
        content: 'Physics insight',
        source: 'unit-test',
        tags: ['unit'],
        timestamp: new Date().toISOString()
      }
    ]
    const derivationHistory: AgentResponse[] = [
      {
        id: 'resp-1',
        agent: 'Phys-Alpha',
        content: 'Initial derivation content',
        timestamp: new Date().toISOString(),
        cycle: 1,
        goalId: 'goal-1'
      }
    ]

    render(
      <KnowledgeGraph
        knowledgeBase={knowledgeBase}
        derivationHistory={derivationHistory}
        goals={goals}
      />
    )

    expect(screen.getByText('Knowledge Graph')).toBeInTheDocument()
    expect(
      screen.getByText('Interactive Graph Visualization', { exact: false })
    ).toBeInTheDocument()
  })

  it('mounts agent settings with defaults and server-backed persistence', async () => {
    render(<AgentSettings />)

    expect(await screen.findByText('Agent Settings')).toBeInTheDocument()
    expect(screen.getByText('Agent Configuration')).toBeInTheDocument()
    expect(screen.getByText('Provider Credentials')).toBeInTheDocument()
    expect(screen.getByText('Autonomous Mode')).toBeInTheDocument()
  })
})
