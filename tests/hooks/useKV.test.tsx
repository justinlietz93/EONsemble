import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { clearKVStore, setKVStorageAdapter, useKV } from '@/hooks/useKV'

const persistenceMocks = vi.hoisted(() => ({
  fetchPersistedValue: vi.fn<(key: string) => Promise<unknown | undefined>>(),
  savePersistedValue: vi.fn<(key: string, value: unknown) => Promise<void>>()
}))

vi.mock('@/lib/api/persistence', () => persistenceMocks)

const { fetchPersistedValue, savePersistedValue } = persistenceMocks

const dispatchStorageEvent = (key: string, newValue: string | null) => {
  const event = new StorageEvent('storage', { key, newValue })
  Object.defineProperty(event, 'storageArea', {
    value: window.localStorage,
    configurable: true
  })
  window.dispatchEvent(event)
}

describe('useKV', () => {
  beforeEach(() => {
    clearKVStore()
    fetchPersistedValue.mockReset()
    savePersistedValue.mockReset()
    setKVStorageAdapter()
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
  })

  it('retains local updates when persistence hydration resolves undefined after the update', async () => {
    let resolveFetch: (() => void) | undefined
    fetchPersistedValue.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveFetch = () => resolve(undefined)
        })
    )
    savePersistedValue.mockResolvedValue()

    type Entry = { id: string }

    const { result } = renderHook(() => useKV<Entry[]>('knowledge-base', () => []))

    act(() => {
      result.current[1]([{ id: 'entry-1' }])
    })

    await act(async () => {
      resolveFetch?.()
      await Promise.resolve()
    })

    expect(result.current[0]).toEqual([{ id: 'entry-1' }])
    expect(fetchPersistedValue).toHaveBeenCalledTimes(1)
  })

  it('drops stale persisted values when hydration resolves after a newer local update', async () => {
    let resolveFetch: ((value: unknown) => void) | undefined
    fetchPersistedValue.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveFetch = resolve
        })
    )
    savePersistedValue.mockResolvedValue()

    type Entry = { id: string }

    const { result } = renderHook(() => useKV<Entry[]>('knowledge-base', () => []))

    act(() => {
      result.current[1]([{ id: 'local-entry' }])
    })

    await act(async () => {
      resolveFetch?.([])
      await Promise.resolve()
    })

    expect(result.current[0]).toEqual([{ id: 'local-entry' }])
    expect(fetchPersistedValue).toHaveBeenCalledTimes(1)
  })

  it('hydrates from persisted storage when available', async () => {
    type Entry = { id: string }

    fetchPersistedValue.mockResolvedValueOnce([{ id: 'persisted' }])
    savePersistedValue.mockResolvedValue()

    const { result } = renderHook(() => useKV<Entry[]>('knowledge-base', () => []))

    await waitFor(() => {
      expect(result.current[0]).toEqual([{ id: 'persisted' }])
    })
  })

  it('hydrates from the storage adapter when persistence is unavailable', async () => {
    type Entry = { id: string }

    const storageState: Record<string, Entry[]> = {
      'knowledge-base': [{ id: 'mirror-entry' }]
    }
    const metadataState: Record<string, { lastUpdatedAt: number; lastSyncedAt: number | null }> = {}

    setKVStorageAdapter({
      read: (key) => storageState[key] as Entry[] | undefined,
      write: (key, value) => {
        storageState[key] = value as Entry[]
      },
      remove: (key) => {
        delete storageState[key]
      },
      readMetadata: (key) => metadataState[key],
      writeMetadata: (key, metadata) => {
        metadataState[key] = metadata
      },
      removeMetadata: (key) => {
        delete metadataState[key]
      }
    })

    fetchPersistedValue.mockResolvedValueOnce(undefined)
    savePersistedValue.mockResolvedValue()

    const { result } = renderHook(() => useKV<Entry[]>('knowledge-base', () => []))

    await waitFor(() => {
      expect(result.current[0]).toEqual([{ id: 'mirror-entry' }])
    })

    act(() => {
      result.current[1](prev => [...(prev ?? []), { id: 'added-entry' }])
    })

    expect(storageState['knowledge-base']).toEqual([
      { id: 'mirror-entry' },
      { id: 'added-entry' }
    ])
  })

  it('syncs updates from other tabs without issuing duplicate persistence writes', async () => {
    type Entry = { id: string }

    fetchPersistedValue.mockResolvedValueOnce(undefined)
    savePersistedValue.mockResolvedValue()

    const { result } = renderHook(() => useKV<Entry[]>('shared-knowledge', () => []))

    act(() => {
      result.current[1]([{ id: 'local-entry' }])
    })

    await waitFor(() => {
      expect(result.current[0]).toEqual([{ id: 'local-entry' }])
    })

    savePersistedValue.mockClear()

    const externalEntries: Entry[] = [{ id: 'external-entry' }]
    window.localStorage.setItem('eon.kv.shared-knowledge', JSON.stringify(externalEntries))
    window.localStorage.setItem(
      'eon.kv.meta.shared-knowledge',
      JSON.stringify({ lastUpdatedAt: Date.now(), lastSyncedAt: Date.now() })
    )

    await act(async () => {
      dispatchStorageEvent('eon.kv.shared-knowledge', JSON.stringify(externalEntries))
      dispatchStorageEvent(
        'eon.kv.meta.shared-knowledge',
        JSON.stringify({ lastUpdatedAt: Date.now(), lastSyncedAt: Date.now() })
      )
    })

    await waitFor(() => {
      expect(result.current[0]).toEqual(externalEntries)
    })

    expect(savePersistedValue).not.toHaveBeenCalled()
  })

  it('honours the hydration predicate when applying storage events', async () => {
    type Entry = { id: string }

    fetchPersistedValue.mockResolvedValueOnce(undefined)
    savePersistedValue.mockResolvedValue()

    const { result } = renderHook(() =>
      useKV<Entry[]>(
        'predicate-knowledge',
        () => [{ id: 'initial-entry' }],
        {
          shouldAcceptHydration: (incoming) => Array.isArray(incoming) && incoming.length >= 1
        }
      )
    )

    await waitFor(() => {
      expect(result.current[0]).toEqual([{ id: 'initial-entry' }])
    })

    window.localStorage.setItem('eon.kv.predicate-knowledge', JSON.stringify([]))

    await act(async () => {
      dispatchStorageEvent('eon.kv.predicate-knowledge', JSON.stringify([]))
    })

    expect(result.current[0]).toEqual([{ id: 'initial-entry' }])
  })

  it('keeps mirrored values when pending sync metadata exists and hydration returns an empty array', async () => {
    type Entry = { id: string }

    const storageState: Record<string, Entry[]> = {
      'knowledge-base': [{ id: 'mirror-entry' }]
    }
    const metadataState: Record<string, { lastUpdatedAt: number; lastSyncedAt: number | null }> = {
      'knowledge-base': {
        lastUpdatedAt: Date.now(),
        lastSyncedAt: null
      }
    }

    setKVStorageAdapter({
      read: (key) => storageState[key] as Entry[] | undefined,
      write: (key, value) => {
        storageState[key] = value as Entry[]
      },
      remove: (key) => {
        delete storageState[key]
      },
      readMetadata: (key) => metadataState[key],
      writeMetadata: (key, metadata) => {
        metadataState[key] = metadata
      },
      removeMetadata: (key) => {
        delete metadataState[key]
      }
    })

    fetchPersistedValue.mockResolvedValueOnce([])
    savePersistedValue.mockResolvedValue()

    const { result } = renderHook(() => useKV<Entry[]>('knowledge-base', () => []))

    await waitFor(() => {
      expect(result.current[0]).toEqual([{ id: 'mirror-entry' }])
    })

    await waitFor(() => {
      expect(savePersistedValue).toHaveBeenCalledWith('knowledge-base', [
        { id: 'mirror-entry' }
      ])
    })
  })

  it('replays the local mirror when a later hydration returns null after a successful sync', async () => {
    type Entry = { id: string }

    const storageState: Record<string, Entry[]> = {}
    const metadataState: Record<string, { lastUpdatedAt: number; lastSyncedAt: number | null }> = {}

    setKVStorageAdapter({
      read: (key) => storageState[key] as Entry[] | undefined,
      write: (key, value) => {
        storageState[key] = value as Entry[]
      },
      remove: (key) => {
        delete storageState[key]
      },
      readMetadata: (key) => metadataState[key],
      writeMetadata: (key, metadata) => {
        metadataState[key] = metadata
      },
      removeMetadata: (key) => {
        delete metadataState[key]
      }
    })

    fetchPersistedValue.mockResolvedValueOnce(undefined)
    savePersistedValue.mockResolvedValue()

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { result, unmount } = renderHook(() => useKV<Entry[]>('knowledge-base', () => []))

    act(() => {
      result.current[1]([{ id: 'entry-1' }])
    })

    await waitFor(() => {
      expect(savePersistedValue).toHaveBeenCalledWith('knowledge-base', [
        { id: 'entry-1' }
      ])
    })

    const callsBeforeRemount = savePersistedValue.mock.calls.length

    unmount()

    fetchPersistedValue.mockResolvedValueOnce(null)

    const { result: remounted } = renderHook(() => useKV<Entry[]>('knowledge-base', () => []))

    await waitFor(() => {
      expect(remounted.current[0]).toEqual([{ id: 'entry-1' }])
    })

    await waitFor(() => {
      expect(savePersistedValue.mock.calls.length).toBeGreaterThan(callsBeforeRemount)
    })

    expect(savePersistedValue).toHaveBeenLastCalledWith('knowledge-base', [
      { id: 'entry-1' }
    ])

    warnSpy.mockRestore()
  })

  it('rejects shrinkage-only hydration when predicate vetoes the incoming payload', async () => {
    type Entry = { id: string }

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const storageState: Record<string, Entry[]> = {
      'knowledge-base': [
        { id: 'mirror-entry' },
        { id: 'another-entry' }
      ]
    }
    const now = Date.now()
    const metadataState: Record<string, { lastUpdatedAt: number; lastSyncedAt: number | null }> = {
      'knowledge-base': {
        lastUpdatedAt: now,
        lastSyncedAt: now
      }
    }

    setKVStorageAdapter({
      read: (key) => storageState[key] as Entry[] | undefined,
      write: (key, value) => {
        storageState[key] = value as Entry[]
      },
      remove: (key) => {
        delete storageState[key]
      },
      readMetadata: (key) => metadataState[key],
      writeMetadata: (key, metadata) => {
        metadataState[key] = metadata
      },
      removeMetadata: (key) => {
        delete metadataState[key]
      }
    })

    fetchPersistedValue.mockResolvedValueOnce([])
    savePersistedValue.mockResolvedValue()

    const { result } = renderHook(() =>
      useKV<Entry[]>(
        'knowledge-base',
        () => [],
        {
          shouldAcceptHydration: (incoming, { localValue }) => {
            if (Array.isArray(localValue) && localValue.length > 0 && Array.isArray(incoming)) {
              return incoming.length >= localValue.length
            }

            return true
          }
        }
      )
    )

    await waitFor(() => {
      expect(result.current[0]).toEqual(storageState['knowledge-base'])
    })

    await waitFor(() => {
      expect(savePersistedValue).toHaveBeenCalledWith('knowledge-base', storageState['knowledge-base'])
    })

    warnSpy.mockRestore()
  })
})
