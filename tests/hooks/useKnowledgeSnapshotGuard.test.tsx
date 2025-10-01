import { act, renderHook } from '@testing-library/react'
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
})
