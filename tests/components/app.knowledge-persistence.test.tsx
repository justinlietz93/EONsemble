import '@testing-library/jest-dom/vitest'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

import { useState } from 'react'

import App from '@/App'
import { KnowledgeBase } from '@/components/KnowledgeBase'
import type { KnowledgeEntry } from '@/App'
import { clearKVStore, useKV } from '@/hooks/useKV'

class ResizeObserverMock implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
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

function KnowledgeHarness() {
  const [isVisible, setIsVisible] = useState(true)
  const [knowledgeBase, setKnowledgeBase] = useKV<KnowledgeEntry[]>('knowledge-base-test', [])

  return (
    <div>
      <button type="button" onClick={() => setIsVisible(prev => !prev)}>
        Toggle View
      </button>
      <button
        type="button"
        onClick={() =>
          setKnowledgeBase(prev => [
            ...(Array.isArray(prev) ? prev : []),
            {
              id: `test-${Date.now()}`,
              title: 'Harness Entry',
              content: 'Test content',
              source: 'harness',
              tags: ['test'],
              timestamp: new Date().toISOString()
            }
          ])
        }
      >
        Add Entry
      </button>
      <div data-testid="entry-count">{knowledgeBase?.length ?? 0}</div>
      {isVisible ? (
        <KnowledgeBase
          knowledgeBase={knowledgeBase || []}
          setKnowledgeBase={setKnowledgeBase}
          derivationHistory={[]}
          goals={[]}
        />
      ) : (
        <div data-testid="placeholder">Goal Setup View</div>
      )}
    </div>
  )
}

describe('Knowledge base persistence behaviour', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal('fetch', buildFetchMock())
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)

    const storageMock = () => {
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

    vi.stubGlobal('localStorage', storageMock() as unknown as Storage)
    vi.stubGlobal('sessionStorage', storageMock() as unknown as Storage)
    clearKVStore()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('retains knowledge entries when the knowledge view is hidden and shown again', async () => {
    render(<KnowledgeHarness />)

    const addEntryButton = screen.getByRole('button', { name: /add entry/i })
    fireEvent.click(addEntryButton)

    expect(screen.getByTestId('entry-count')).toHaveTextContent('1')

    const toggleButton = screen.getByRole('button', { name: /toggle view/i })
    fireEvent.click(toggleButton)
    fireEvent.click(toggleButton)

    expect(screen.getByTestId('entry-count')).toHaveTextContent('1')
  })

  it('retains knowledge entries after switching away and back to the knowledge tab', async () => {
    sessionStorage.setItem('eon.activeTab', 'knowledge')

    render(<App />)

    const knowledgeHeading = await screen.findByRole('heading', { name: /knowledge base/i })
    const knowledgeView = knowledgeHeading.closest('div')?.parentElement?.parentElement ?? document.body

    // The empty state renders an "Add Test Data" button that seeds a sample entry
    const addTestDataButton = await within(knowledgeView).findByRole('button', { name: /add test data/i })
    fireEvent.click(addTestDataButton)

    // Confirm the sample knowledge entry is visible
    const entryCard = await within(knowledgeView).findByText(/sample physics knowledge/i)
    expect(entryCard).toBeInTheDocument()

    // Navigate away and back again
    const goalSetupTab = screen.getByRole('tab', { name: /goal setup/i })
    fireEvent.pointerDown(goalSetupTab)
    fireEvent.click(goalSetupTab)

    const knowledgeTab = screen.getByRole('tab', { name: /knowledge base/i })
    fireEvent.pointerDown(knowledgeTab)
    fireEvent.click(knowledgeTab)

    // The sample entry should still be present
    const knowledgeSection = await screen.findByRole('heading', { name: /knowledge base/i })
    const sectionContainer = knowledgeSection.closest('div')?.parentElement?.parentElement ?? document.body
    const cardTitles = within(sectionContainer).queryAllByText(/sample physics knowledge/i)
    expect(cardTitles.length).toBeGreaterThan(0)
  })

  it('currently loses knowledge entries when the persistence API hydrates null values', async () => {
    sessionStorage.setItem('eon.activeTab', 'knowledge')

    const persistedStore: { value?: unknown } = {}
    let getCount = 0

    const customFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      const method = init?.method ?? 'GET'

      if (url.includes('/api/state/knowledge-base')) {
        if (method === 'PUT') {
          const body = typeof init?.body === 'string' ? init.body : ''
          persistedStore.value = JSON.parse(body || '{}').value
          return new Response(JSON.stringify({ value: persistedStore.value }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        }

        getCount += 1
        if (getCount === 1) {
          return new Response(JSON.stringify({ value: null }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          })
        }

        return new Response(JSON.stringify({ value: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      return buildFetchMock()(input, init)
    })

    vi.stubGlobal('fetch', customFetch)

    const { unmount } = render(<App />)

    const knowledgeHeading = await screen.findByRole('heading', { name: /knowledge base/i })
    const knowledgeView = knowledgeHeading.closest('div')?.parentElement?.parentElement ?? document.body
    const addTestDataButton = await within(knowledgeView).findByRole('button', { name: /add test data/i })
    fireEvent.click(addTestDataButton)

    expect(await within(knowledgeView).findByText(/sample physics knowledge/i)).toBeInTheDocument()

    unmount()

    render(<App />)

    await waitFor(() => {
      const getCalls = customFetch.mock.calls.filter(([request]) =>
        request.toString().includes('/api/state/knowledge-base')
      )
      const totalGets = getCalls.filter(([, init]) => (init?.method ?? 'GET') === 'GET').length
      expect(totalGets).toBeGreaterThan(1)
    })

    const reloadedSection = await screen.findByRole('heading', { name: /knowledge base/i })
    const reloadedContainer = reloadedSection.closest('div')?.parentElement?.parentElement ?? document.body
    const entriesAfterReload = within(reloadedContainer).queryAllByText(/sample physics knowledge/i)

    expect(entriesAfterReload.length).toBeGreaterThan(0)
  })
})
