import { act, renderHook, waitFor } from '@testing-library/react'
import { useCallback, useState } from 'react'

import type { KnowledgeEntry } from '@/App'
import { useKnowledgeSnapshotGuard } from '@/hooks/useKnowledgeSnapshotGuard'
import type { KVUpdater } from '@/hooks/useKV'

const buildEntry = (id: string): KnowledgeEntry => ({
  id,
  title: `Entry ${id}`,
  content: `Content ${id}`,
  source: 'test-suite',
  tags: ['physics'],
  timestamp: new Date(2025, 8, 29, 12, 0, 0).toISOString()
})

describe('useKnowledgeSnapshotGuard', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  it('restores the last snapshot when the knowledge base unexpectedly becomes empty', () => {
    const initialEntries = [buildEntry('1'), buildEntry('2')]

    const { result } = renderHook(() => {
      const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>(initialEntries)
      const kvSet = useCallback((updater: KVUpdater<KnowledgeEntry[]>) => {
        setKnowledge(prev => (typeof updater === 'function' ? updater(prev) : updater))
      }, [])

      useKnowledgeSnapshotGuard(knowledge, kvSet)

      return { knowledge, setKnowledge: kvSet }
    })

    expect(result.current.knowledge).toHaveLength(2)

    act(() => {
      result.current.setKnowledge(() => [])
    })

    expect(result.current.knowledge).toHaveLength(2)
    expect(result.current.knowledge.map(entry => entry.id)).toEqual(['1', '2'])
  })

  it('does not restore when the empty state is expected', () => {
    const initialEntries = [buildEntry('1')]

    const { result } = renderHook(() => {
      const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>(initialEntries)
      const kvSet = useCallback((updater: KVUpdater<KnowledgeEntry[]>) => {
        setKnowledge(prev => (typeof updater === 'function' ? updater(prev) : updater))
      }, [])

      const shouldAllowEmpty = useCallback(() => false, [])

      useKnowledgeSnapshotGuard(knowledge, kvSet, {
        isUnexpectedEmpty: shouldAllowEmpty
      })

      return { knowledge, setKnowledge: kvSet }
    })

    act(() => {
      result.current.setKnowledge(() => [])
    })

    expect(result.current.knowledge).toHaveLength(0)
  })

  it('restores the persisted session snapshot after a remount with an empty knowledge array', async () => {
    const storageKey = 'test.session.snapshot'
    const initialEntries = [buildEntry('persisted')]

    const { unmount } = renderHook(() => {
      const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>(initialEntries)
      const kvSet = useCallback((updater: KVUpdater<KnowledgeEntry[]>) => {
        setKnowledge(prev => (typeof updater === 'function' ? updater(prev) : updater))
      }, [])

      useKnowledgeSnapshotGuard(knowledge, kvSet, { storageKey })

      return { knowledge }
    })

    expect(JSON.parse(sessionStorage.getItem(storageKey) ?? '[]')).toHaveLength(1)
    expect(JSON.parse(localStorage.getItem(`${storageKey}.local`) ?? '[]')).toHaveLength(1)
    unmount()

    const { result } = renderHook(() => {
      const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([])
      const kvSet = useCallback((updater: KVUpdater<KnowledgeEntry[]>) => {
        setKnowledge(prev => (typeof updater === 'function' ? updater(prev) : updater))
      }, [])

      useKnowledgeSnapshotGuard(knowledge, kvSet, { storageKey })

      return { knowledge }
    })

    await waitFor(() => {
      expect(result.current.knowledge).toHaveLength(1)
    })
    expect(result.current.knowledge[0]?.id).toBe('persisted')
  })

  it('clears the persisted snapshot when emptiness is expected', () => {
    const storageKey = 'test.session.snapshot'
    const initialEntries = [buildEntry('1')]

    const { result } = renderHook(() => {
      const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>(initialEntries)
      const kvSet = useCallback((updater: KVUpdater<KnowledgeEntry[]>) => {
        setKnowledge(prev => (typeof updater === 'function' ? updater(prev) : updater))
      }, [])
      const allowEmpty = useCallback(() => false, [])

      useKnowledgeSnapshotGuard(knowledge, kvSet, { storageKey, isUnexpectedEmpty: allowEmpty })

      return { setKnowledge: kvSet }
    })

    act(() => {
      result.current.setKnowledge(() => [])
    })

    return waitFor(() => {
      expect(sessionStorage.getItem(storageKey)).toBeNull()
      expect(localStorage.getItem(`${storageKey}.local`)).toBeNull()
      const localKeys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
      expect(localKeys.filter(key => key?.startsWith(`${storageKey}.local`))).toHaveLength(0)
    })
  })

  it('restores the local snapshot backup on initial load when session storage is empty', async () => {
    const storageKey = 'test.session.snapshot'
    const initialEntries = [buildEntry('local-only')]

    const { unmount } = renderHook(() => {
      const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>(initialEntries)
      const kvSet = useCallback((updater: KVUpdater<KnowledgeEntry[]>) => {
        setKnowledge(prev => (typeof updater === 'function' ? updater(prev) : updater))
      }, [])

      useKnowledgeSnapshotGuard(knowledge, kvSet, { storageKey })

      return { knowledge }
    })

    unmount()

    // Simulate a new tab: sessionStorage is empty, but the local backup remains.
    sessionStorage.removeItem(storageKey)
    expect(localStorage.getItem(`${storageKey}.local`)).not.toBeNull()

    const { result } = renderHook(() => {
      const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([])
      const kvSet = useCallback((updater: KVUpdater<KnowledgeEntry[]>) => {
        setKnowledge(prev => (typeof updater === 'function' ? updater(prev) : updater))
      }, [])

      useKnowledgeSnapshotGuard(knowledge, kvSet, { storageKey, restoreOnInitialLoad: true })

      return { knowledge }
    })

    await waitFor(() => {
      expect(result.current.knowledge).toHaveLength(1)
    })
    expect(result.current.knowledge[0]?.id).toBe('local-only')
  })

  it('persists large knowledge snapshots using chunked storage and restores them after remount', async () => {
    const storageKey = 'test.large.snapshot'
    const largeEntry = {
      ...buildEntry('large'),
      content: 'quantum persistence '.repeat(40_000)
    }

    const { unmount } = renderHook(() => {
      const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([largeEntry])
      const kvSet = useCallback((updater: KVUpdater<KnowledgeEntry[]>) => {
        setKnowledge(prev => (typeof updater === 'function' ? updater(prev) : updater))
      }, [])

      useKnowledgeSnapshotGuard(knowledge, kvSet, { storageKey })

      return { knowledge }
    })

    const manifest = JSON.parse(localStorage.getItem(`${storageKey}.local`) ?? '{}') as Record<string, unknown>
    expect(manifest.__knowledgeSnapshotChunkManifest).toBe(true)
    const chunkCount = typeof manifest.chunkCount === 'number' ? manifest.chunkCount : 0
    expect(chunkCount).toBeGreaterThan(0)

    for (let index = 0; index < chunkCount; index += 1) {
      expect(localStorage.getItem(`${storageKey}.local::chunk::${index}`)).not.toBeNull()
    }

    unmount()

    const { result } = renderHook(() => {
      const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([])
      const kvSet = useCallback((updater: KVUpdater<KnowledgeEntry[]>) => {
        setKnowledge(prev => (typeof updater === 'function' ? updater(prev) : updater))
      }, [])

      useKnowledgeSnapshotGuard(knowledge, kvSet, { storageKey, restoreOnInitialLoad: true })

      return { knowledge }
    })

    await waitFor(() => {
      expect(result.current.knowledge).toHaveLength(1)
    })

    expect(result.current.knowledge[0]?.id).toBe('large')
    expect(result.current.knowledge[0]?.content.length).toBe(largeEntry.content.length)
  })
})
