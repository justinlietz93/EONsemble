import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { clearKVStore, setKVStorageAdapter, useKV } from '@/hooks/useKV'

const persistenceMocks = vi.hoisted(() => ({
  fetchPersistedValue: vi.fn<(key: string) => Promise<unknown | undefined>>(),
  savePersistedValue: vi.fn<(key: string, value: unknown) => Promise<void>>()
}))

vi.mock('@/lib/api/persistence', () => persistenceMocks)

const { fetchPersistedValue, savePersistedValue } = persistenceMocks

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
    savePersistedValue.mockResolvedValueOnce()

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
})
