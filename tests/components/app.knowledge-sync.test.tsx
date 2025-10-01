import '@testing-library/jest-dom/vitest'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

import App from '@/App'
import { clearKVStore } from '@/hooks/useKV'

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

describe('knowledge persistence resync safeguards', () => {
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

  class ResizeObserverMock implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    clearKVStore()

    const localStorage = storageMock() as unknown as Storage
    const sessionStorage = storageMock() as unknown as Storage
    vi.stubGlobal('localStorage', localStorage)
    vi.stubGlobal('sessionStorage', sessionStorage)
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
        const text = `Mock content from ${name} `.repeat(4)
        queueMicrotask(() => this.emitResult(text))
      }

      readAsArrayBuffer(_: Blob): void {
        const buffer = new ArrayBuffer(4)
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
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('skips stale server hydration and resubmits unsynced knowledge entries', async () => {
    const persistedStore: { value?: unknown } = {}
    let getCount = 0
    let putCount = 0

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      const method = init?.method ?? 'GET'

      if (url.includes('/api/state/knowledge-base')) {
        if (method === 'PUT') {
          putCount += 1

          const body = typeof init?.body === 'string' ? init.body : ''
          let value: unknown = null
          try {
            value = JSON.parse(body || '{}').value ?? null
          } catch {
            value = null
          }
          persistedStore.value = value

          return new Response(JSON.stringify({ value }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        }

        if (method === 'GET') {
          getCount += 1
          if (getCount === 1) {
            return new Response(JSON.stringify({ value: null }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' }
            })
          }

          return new Response(JSON.stringify({ value: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        }
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

    vi.stubGlobal('fetch', fetchMock)

    sessionStorage.setItem('eon.activeTab', 'knowledge')

    const { unmount } = render(<App />)

    const knowledgeHeading = await screen.findByRole('heading', { name: /knowledge base/i })
    const knowledgeView = knowledgeHeading.closest('div')?.parentElement?.parentElement ?? document.body

    const addTestDataButton = await within(knowledgeView).findByRole('button', { name: /add test data/i })
    fireEvent.click(addTestDataButton)

    await waitFor(() => {
      expect(within(knowledgeView).getByText(/sample physics knowledge/i)).toBeInTheDocument()
    })

    localStorage.setItem(
      'eon.kv.meta.knowledge-base',
      JSON.stringify({
        lastUpdatedAt: Date.now(),
        lastSyncedAt: null
      })
    )

    unmount()

    render(<App />)

    const reloadedHeading = await screen.findByRole('heading', { name: /knowledge base/i })
    const reloadedView = reloadedHeading.closest('div')?.parentElement?.parentElement ?? document.body

    await waitFor(() => {
      expect(within(reloadedView).getByText(/sample physics knowledge/i)).toBeInTheDocument()
      expect(putCount).toBeGreaterThanOrEqual(2)
      expect(Array.isArray(persistedStore.value)).toBe(true)
      expect((persistedStore.value as unknown[]).length).toBeGreaterThan(0)
    })
  })
})
