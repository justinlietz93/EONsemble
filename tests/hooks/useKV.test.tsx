import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { clearKVStore, useKV } from '@/hooks/useKV'

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
})
