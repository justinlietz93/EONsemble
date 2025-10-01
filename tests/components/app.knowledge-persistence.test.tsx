import '@testing-library/jest-dom/vitest'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { useState } from 'react'

import App from '@/App'
import { KnowledgeBase } from '@/components/KnowledgeBase'
import type { KnowledgeEntry } from '@/App'
import { clearKVStore, useKV } from '@/hooks/useKV'

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

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

    class FileReaderStub implements Partial<FileReader> {
      public result: string | ArrayBuffer | null = null
      public readyState = 2
      public onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null = null
      public onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null = null

      private emitResult(result: string | ArrayBuffer): void {
        this.result = result
        if (this.onload) {
          const event = {
            target: { result }
          } as ProgressEvent<FileReader>
          this.onload.call(this as unknown as FileReader, event)
        }
      }

      readAsText(blob: Blob): void {
        const name = (blob as File).name ?? 'mock-file'
        const text = `Mock content from ${name} `.repeat(8)
        queueMicrotask(() => this.emitResult(text))
      }

      readAsArrayBuffer(blob: Blob): void {
        const buffer = new ArrayBuffer(8)
        new Uint8Array(buffer).set([1, 2, 3, 4, 5, 6, 7, 8])
        queueMicrotask(() => this.emitResult(buffer))
      }

      abort(): void {}
      addEventListener(): void {}
      removeEventListener(): void {}
      dispatchEvent(): boolean {
        return true
      }
    }

    vi.stubGlobal('FileReader', FileReaderStub as unknown as typeof FileReader)

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

  it('retains corpus-uploaded knowledge after switching tabs (currently failing)', async () => {
    sessionStorage.setItem('eon.activeTab', 'knowledge')

    const persistedStore = new Map<string, unknown>()

    const statefulFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      const method = init?.method ?? 'GET'

      if (url.includes('/api/state/')) {
        const key = decodeURIComponent(url.split('/api/state/')[1] ?? '')

        if (method === 'PUT') {
          const body = typeof init?.body === 'string' ? init.body : ''
          let value: unknown = null
          try {
            value = JSON.parse(body || '{}').value ?? null
          } catch {
            value = null
          }
          persistedStore.set(key, value)
          return new Response(JSON.stringify({ value }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        }

        if (method === 'GET') {
          if (!persistedStore.has(key)) {
            return new Response(JSON.stringify({ value: null }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' }
            })
          }

          return new Response(JSON.stringify({ value: persistedStore.get(key) ?? null }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }

      return buildFetchMock()(input, init)
    })

    vi.stubGlobal('fetch', statefulFetch)

    render(<App />)

    const knowledgeHeading = await screen.findByRole('heading', { name: /knowledge base/i })
    const knowledgeView = knowledgeHeading.closest('div')?.parentElement?.parentElement ?? document.body

    const user = userEvent.setup()
    const uploadTab = within(knowledgeView).getByRole('tab', { name: /upload corpus/i })
    await user.click(uploadTab)

    await waitFor(() => {
      expect(document.getElementById('file-upload')).not.toBeNull()
    })

    const fileInput = document.getElementById('file-upload') as HTMLInputElement

    const sampleFile = new File([
      'Quantum field theory insights for persistence verification '.repeat(20)
    ], 'quantum-notes.txt', { type: 'text/plain' })

    await user.upload(fileInput, sampleFile)

    const goalSetupTab = screen.getByRole('tab', { name: /goal setup/i })
    await user.click(goalSetupTab)

    const knowledgeTab = screen.getByRole('tab', { name: /knowledge base/i })
    await user.click(knowledgeTab)

    const reenteredHeading = await screen.findByRole('heading', { name: /knowledge base/i })
    const reenteredView = reenteredHeading.closest('div')?.parentElement?.parentElement ?? document.body

    const browseTab = within(reenteredView).getByRole('tab', { name: /browse/i })
    await user.click(browseTab)

    await waitFor(() => {
      const stored = persistedStore.get('knowledge-base') as unknown[] | undefined
      expect(Array.isArray(stored) && stored.length > 0).toBe(true)
    })

    await waitFor(() => {
      expect(
        within(reenteredView).getByText(/quantum-notes.txt - section 1/i)
      ).toBeInTheDocument()
    })

    const entriesAfterSwitch = within(reenteredView).queryAllByText(/quantum-notes.txt - section 1/i)

    expect(entriesAfterSwitch.length).toBeGreaterThan(0)
  })

  it('restores knowledge when storage events force a persistence reset mid-session', async () => {
    sessionStorage.setItem('eon.activeTab', 'knowledge')

    const fetchMock = buildFetchMock()
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    const knowledgeHeading = await screen.findByRole('heading', { name: /knowledge base/i })
    const knowledgeView = knowledgeHeading.closest('div')?.parentElement?.parentElement ?? document.body

    const addTestDataButton = await within(knowledgeView).findByRole('button', { name: /add test data/i })
    fireEvent.click(addTestDataButton)

    await within(knowledgeView).findByText(/sample physics knowledge/i)

    const knowledgeTab = screen.getByRole('tab', { name: /knowledge base/i })
    await userEvent.click(knowledgeTab)

    const dispatchStorageEvent = (key: string, newValue: string | null) => {
      const event = new Event('storage') as StorageEvent
      Object.defineProperties(event, {
        key: { value: key },
        newValue: { value: newValue },
        storageArea: { value: window.localStorage }
      })
      window.dispatchEvent(event)
    }

    await act(async () => {
      window.localStorage.setItem('eon.kv.active-tab', JSON.stringify('goal-setup'))
      dispatchStorageEvent('eon.kv.active-tab', JSON.stringify('goal-setup'))
    })

    await act(async () => {
      window.localStorage.setItem('eon.kv.knowledge-base', JSON.stringify([]))
      dispatchStorageEvent('eon.kv.knowledge-base', JSON.stringify([]))
    })

    await waitFor(() => {
      const restoredHeading = screen.getByRole('heading', { name: /knowledge base/i })
      const restoredView = restoredHeading.closest('div')?.parentElement?.parentElement ?? document.body
      expect(within(restoredView).getByText(/sample physics knowledge/i)).toBeInTheDocument()
    })
  })

  it('restores knowledge after regressive hydration when local mirrors are unavailable', async () => {
    sessionStorage.setItem('eon.activeTab', 'knowledge')

    const persistedStore = new Map<string, unknown>()
    let initialHydrationHandled = false
    let resolveInitialHydration: ((response: Response) => void) | null = null
    const initialHydrationPromise = new Promise<Response>(resolve => {
      resolveInitialHydration = response => {
        resolve(response)
        resolveInitialHydration = null
      }
    })

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      const method = init?.method ?? 'GET'

      if (url.includes('/api/state/knowledge-base')) {
        if (method === 'PUT') {
          const body = typeof init?.body === 'string' ? init.body : ''
          let value: unknown = null
          try {
            value = JSON.parse(body || '{}').value ?? null
          } catch {
            value = null
          }
          persistedStore.set('knowledge-base', value)
          return new Response(JSON.stringify({ value }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        }

        if (!initialHydrationHandled) {
          initialHydrationHandled = true
          return initialHydrationPromise
        }

        const stored = persistedStore.get('knowledge-base') ?? null
        return new Response(JSON.stringify({ value: stored }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      return buildFetchMock()(input, init)
    })

    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    const knowledgeHeading = await screen.findByRole('heading', { name: /knowledge base/i })
    const knowledgeView = knowledgeHeading.closest('div')?.parentElement?.parentElement ?? document.body

    const addTestDataButton = await within(knowledgeView).findByRole('button', { name: /add test data/i })
    fireEvent.click(addTestDataButton)

    expect(await within(knowledgeView).findByText(/sample physics knowledge/i)).toBeInTheDocument()

    await waitFor(() => {
      const putCalls = fetchMock.mock.calls.filter(([, init]) => (init?.method ?? 'GET') === 'PUT')
      expect(putCalls.length).toBeGreaterThan(0)
    })

    window.localStorage.removeItem('eon.kv.knowledge-base')
    window.localStorage.removeItem('eon.kv.meta.knowledge-base')
    clearKVStore()

    resolveInitialHydration?.(
      new Response(JSON.stringify({ value: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )

    await waitFor(() => {
      const entries = within(knowledgeView).queryAllByText(/sample physics knowledge/i)
      expect(entries.length).toBeGreaterThan(0)
    })

    const knowledgeBadge = await screen.findByText(/knowledge entries/i)
    expect(knowledgeBadge).toHaveTextContent('1')
  })

  it('replays the knowledge snapshot to persistence after rejecting a regressive hydration', async () => {
    sessionStorage.setItem('eon.activeTab', 'knowledge')

    const knowledgePutBodies: unknown[] = []

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      const method = init?.method ?? 'GET'

      if (url.includes('/api/state/knowledge-base')) {
        if (method === 'PUT') {
          const body = typeof init?.body === 'string' ? init.body : ''
          let value: unknown = null
          try {
            value = JSON.parse(body || '{}').value ?? null
          } catch {
            value = null
          }
          knowledgePutBodies.push(value)
          return new Response(JSON.stringify({ value }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        }

        return new Response(JSON.stringify({ value: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }

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

      return buildFetchMock()(input, init)
    })

    vi.stubGlobal('fetch', fetchMock)

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { unmount } = render(<App />)

    const knowledgeHeading = await screen.findByRole('heading', { name: /knowledge base/i })
    const knowledgeView = knowledgeHeading.closest('div')?.parentElement?.parentElement ?? document.body
    const addTestDataButton = await within(knowledgeView).findByRole('button', { name: /add test data/i })
    fireEvent.click(addTestDataButton)

    expect(await within(knowledgeView).findByText(/sample physics knowledge/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(knowledgePutBodies.length).toBeGreaterThanOrEqual(1)
    })

    unmount()

    render(<App />)

    const reloadedHeading = await screen.findByRole('heading', { name: /knowledge base/i })
    const reloadedView = reloadedHeading.closest('div')?.parentElement?.parentElement ?? document.body

    await waitFor(() => {
      expect(within(reloadedView).getAllByText(/sample physics knowledge/i).length).toBeGreaterThan(0)
    })

    await waitFor(() => {
      expect(knowledgePutBodies.length).toBeGreaterThanOrEqual(2)
    })

    expect(knowledgePutBodies[knowledgePutBodies.length - 1]).toEqual(
      knowledgePutBodies[0]
    )

    warnSpy.mockRestore()
  })

  it('retains corpus uploads even when file processing completes after leaving the tab', async () => {
    sessionStorage.setItem('eon.activeTab', 'knowledge')

    const persistedStore = new Map<string, unknown>()

    const statefulFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      const method = init?.method ?? 'GET'

      if (url.includes('/api/state/')) {
        const key = decodeURIComponent(url.split('/api/state/')[1] ?? '')

        if (method === 'PUT') {
          const body = typeof init?.body === 'string' ? init.body : ''
          let value: unknown = null
          try {
            value = JSON.parse(body || '{}').value ?? null
          } catch {
            value = null
          }
          persistedStore.set(key, value)
          return new Response(JSON.stringify({ value }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        }

        if (method === 'GET') {
          if (!persistedStore.has(key)) {
            return new Response(JSON.stringify({ value: null }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' }
            })
          }

          return new Response(JSON.stringify({ value: persistedStore.get(key) ?? null }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }

      return buildFetchMock()(input, init)
    })

    vi.stubGlobal('fetch', statefulFetch)

    const pendingReaders: Array<() => void> = []

    class DeferredFileReaderStub implements Partial<FileReader> {
      public result: string | ArrayBuffer | null = null
      public readyState = 1
      public onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null = null
      public onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null = null

      private emit(result: string | ArrayBuffer): void {
        this.result = result
        this.readyState = 2
        if (this.onload) {
          const event = {
            target: { result }
          } as ProgressEvent<FileReader>
          this.onload.call(this as unknown as FileReader, event)
        }
      }

      readAsText(blob: Blob): void {
        const name = (blob as File).name ?? 'mock-file'
        const text = `Deferred mock content from ${name} `.repeat(8)
        pendingReaders.push(() => this.emit(text))
      }

      readAsArrayBuffer(blob: Blob): void {
        const buffer = new ArrayBuffer(8)
        new Uint8Array(buffer).set([11, 22, 33, 44, 55, 66, 77, 88])
        pendingReaders.push(() => this.emit(buffer))
      }

      abort(): void {}
      addEventListener(): void {}
      removeEventListener(): void {}
      dispatchEvent(): boolean {
        return true
      }
    }

    vi.stubGlobal('FileReader', DeferredFileReaderStub as unknown as typeof FileReader)

    render(<App />)

    const knowledgeHeading = await screen.findByRole('heading', { name: /knowledge base/i })
    const knowledgeView = knowledgeHeading.closest('div')?.parentElement?.parentElement ?? document.body

    const user = userEvent.setup()
    const uploadTab = within(knowledgeView).getByRole('tab', { name: /upload corpus/i })
    await user.click(uploadTab)

    await waitFor(() => {
      expect(document.getElementById('file-upload')).not.toBeNull()
    })

    const fileInput = document.getElementById('file-upload') as HTMLInputElement

    const sampleFile = new File([
      'Staggered quantum persistence scenario '.repeat(20)
    ], 'quantum-delay.txt', { type: 'text/plain' })

    await user.upload(fileInput, sampleFile)

    const goalSetupTab = screen.getByRole('tab', { name: /goal setup/i })
    await user.click(goalSetupTab)

    pendingReaders.splice(0).forEach(run => run())

    await waitFor(() => {
      const stored = persistedStore.get('knowledge-base') as unknown[] | undefined
      expect(Array.isArray(stored) && stored.length > 0).toBe(true)
    })

    const knowledgeTab = screen.getByRole('tab', { name: /knowledge base/i })
    await user.click(knowledgeTab)

    const reenteredHeading = await screen.findByRole('heading', { name: /knowledge base/i })
    const reenteredView = reenteredHeading.closest('div')?.parentElement?.parentElement ?? document.body

    const browseTab = within(reenteredView).getByRole('tab', { name: /browse/i })
    await user.click(browseTab)

    await waitFor(() => {
      expect(
        within(reenteredView).getByText(/quantum-delay.txt - section 1/i)
      ).toBeInTheDocument()
    })
  })

  it('retains knowledge after navigating across collaboration and settings tabs during deferred uploads', async () => {
    sessionStorage.setItem('eon.activeTab', 'knowledge')

    const persistedStore = new Map<string, unknown>()

    const statefulFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      const method = init?.method ?? 'GET'

      if (url.includes('/api/state/')) {
        const key = decodeURIComponent(url.split('/api/state/')[1] ?? '')

        if (method === 'PUT') {
          const body = typeof init?.body === 'string' ? init.body : ''
          let value: unknown = null
          try {
            value = JSON.parse(body || '{}').value ?? null
          } catch {
            value = null
          }
          persistedStore.set(key, value)
          return new Response(JSON.stringify({ value }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        }

        if (method === 'GET') {
          if (!persistedStore.has(key)) {
            return new Response(JSON.stringify({ value: null }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' }
            })
          }

          return new Response(JSON.stringify({ value: persistedStore.get(key) ?? null }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }

      return buildFetchMock()(input, init)
    })

    vi.stubGlobal('fetch', statefulFetch)

    const pendingReaders: Array<() => void> = []

    class MultiTabFileReaderStub implements Partial<FileReader> {
      public result: string | ArrayBuffer | null = null
      public readyState = 1
      public onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null = null
      public onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null = null

      private emit(result: string | ArrayBuffer): void {
        this.result = result
        this.readyState = 2
        if (this.onload) {
          const event = {
            target: { result }
          } as ProgressEvent<FileReader>
          this.onload.call(this as unknown as FileReader, event)
        }
      }

      readAsText(blob: Blob): void {
        const name = (blob as File).name ?? 'mock-file'
        const text = `Deferred multi-tab content from ${name} `.repeat(8)
        pendingReaders.push(() => this.emit(text))
      }

      readAsArrayBuffer(blob: Blob): void {
        const buffer = new ArrayBuffer(8)
        new Uint8Array(buffer).set([3, 6, 9, 12, 15, 18, 21, 24])
        pendingReaders.push(() => this.emit(buffer))
      }

      abort(): void {}
      addEventListener(): void {}
      removeEventListener(): void {}
      dispatchEvent(): boolean {
        return true
      }
    }

    vi.stubGlobal('FileReader', MultiTabFileReaderStub as unknown as typeof FileReader)

    render(<App />)

    const knowledgeHeading = await screen.findByRole('heading', { name: /knowledge base/i })
    const knowledgeView = knowledgeHeading.closest('div')?.parentElement?.parentElement ?? document.body

    const user = userEvent.setup()
    const uploadTab = within(knowledgeView).getByRole('tab', { name: /upload corpus/i })
    await user.click(uploadTab)

    await waitFor(() => {
      expect(document.getElementById('file-upload')).not.toBeNull()
    })

    const fileInput = document.getElementById('file-upload') as HTMLInputElement

    const sampleFile = new File([
      'Cross-tab persistence verification scenario '.repeat(20)
    ], 'multi-tab.txt', { type: 'text/plain' })

    await user.upload(fileInput, sampleFile)

    const collaborationTab = screen.getByRole('tab', { name: /agent collaboration/i })
    await user.click(collaborationTab)

    const settingsTab = screen.getByRole('tab', { name: /agent settings/i })
    await user.click(settingsTab)

    const goalSetupTab = screen.getByRole('tab', { name: /goal setup/i })
    await user.click(goalSetupTab)

    pendingReaders.splice(0).forEach(run => run())

    await waitFor(() => {
      const stored = persistedStore.get('knowledge-base') as unknown[] | undefined
      expect(Array.isArray(stored) && stored.length > 0).toBe(true)
    })

    const knowledgeTab = screen.getByRole('tab', { name: /knowledge base/i })
    await user.click(knowledgeTab)

    const reenteredHeading = await screen.findByRole('heading', { name: /knowledge base/i })
    const reenteredView = reenteredHeading.closest('div')?.parentElement?.parentElement ?? document.body

    await waitFor(() => {
      expect(
        within(reenteredView).getByText(/multi-tab.txt - section 1/i)
      ).toBeInTheDocument()
    })
  })

  it('restores knowledge entries from the browser mirror when persistence fetches fail on reload', async () => {
    sessionStorage.setItem('eon.activeTab', 'knowledge')

    const offlineFetch = vi.fn(async () => {
      throw new TypeError('Network request failed')
    })

    vi.stubGlobal('fetch', offlineFetch)

    const { unmount } = render(<App />)

    const knowledgeHeading = await screen.findByRole('heading', { name: /knowledge base/i })
    const knowledgeView = knowledgeHeading.closest('div')?.parentElement?.parentElement ?? document.body

    const addTestDataButton = await within(knowledgeView).findByRole('button', { name: /add test data/i })
    fireEvent.click(addTestDataButton)

    expect(await within(knowledgeView).findByText(/sample physics knowledge/i)).toBeInTheDocument()

    const mirrored = window.localStorage.getItem('eon.kv.knowledge-base')

    unmount()

    clearKVStore()

    if (mirrored) {
      window.localStorage.setItem('eon.kv.knowledge-base', mirrored)
    }

    render(<App />)

    const reloadedHeading = await screen.findByRole('heading', { name: /knowledge base/i })
    const reloadedView = reloadedHeading.closest('div')?.parentElement?.parentElement ?? document.body

    await waitFor(() => {
      expect(within(reloadedView).getByText(/sample physics knowledge/i)).toBeInTheDocument()
    })
  })
})
