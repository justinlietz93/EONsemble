import { useEffect, useRef } from 'react'

import type { KnowledgeEntry } from '@/App'
import type { KVUpdater } from '@/hooks/useKV'

const cloneEntries = (entries: KnowledgeEntry[]): KnowledgeEntry[] =>
  entries.map(entry => ({
    ...entry,
    tags: [...entry.tags]
  }))

type GuardOptions = {
  /**
   * Optional predicate to flag whether the current empty state should trigger a restoration.
   * Defaults to only restoring when the previous render held entries and we now have none.
   */
  isUnexpectedEmpty?: () => boolean
  /**
   * Provides additional context for diagnostics when the guard restores a snapshot.
   */
  getContext?: () => Record<string, unknown>
}

export function useKnowledgeSnapshotGuard(
  knowledgeBase: KnowledgeEntry[] | undefined,
  setKnowledgeBase: (updater: KVUpdater<KnowledgeEntry[]>) => void,
  options?: GuardOptions
): void {
  const snapshotRef = useRef<KnowledgeEntry[]>(
    Array.isArray(knowledgeBase) && knowledgeBase.length > 0
      ? cloneEntries(knowledgeBase)
      : []
  )
  const previousCountRef = useRef<number>(Array.isArray(knowledgeBase) ? knowledgeBase.length : 0)
  const getContextRef = useRef<GuardOptions['getContext']>(options?.getContext)
  const isUnexpectedEmptyRef = useRef<GuardOptions['isUnexpectedEmpty']>(options?.isUnexpectedEmpty)

  if (getContextRef.current !== options?.getContext) {
    getContextRef.current = options?.getContext
  }

  if (isUnexpectedEmptyRef.current !== options?.isUnexpectedEmpty) {
    isUnexpectedEmptyRef.current = options?.isUnexpectedEmpty
  }

  useEffect(() => {
    const currentCount = Array.isArray(knowledgeBase) ? knowledgeBase.length : 0

    if (Array.isArray(knowledgeBase) && knowledgeBase.length > 0) {
      snapshotRef.current = cloneEntries(knowledgeBase)
      previousCountRef.current = currentCount
      return
    }

    const hadPreviousEntries = previousCountRef.current > 0
    const hasSnapshot = snapshotRef.current.length > 0
    const isUnexpectedEmpty =
      typeof isUnexpectedEmptyRef.current === 'function'
        ? isUnexpectedEmptyRef.current()
        : hadPreviousEntries

    if (currentCount === 0 && hadPreviousEntries && hasSnapshot && isUnexpectedEmpty) {
      const context = typeof getContextRef.current === 'function' ? getContextRef.current() : undefined
      console.warn('[KnowledgeSnapshotGuard] Restoring knowledge base from preserved snapshot', {
        previousCount: previousCountRef.current,
        snapshotCount: snapshotRef.current.length,
        ...context
      })

      const snapshot = cloneEntries(snapshotRef.current)
      setKnowledgeBase(prev => {
        if (Array.isArray(prev) && prev.length > 0) {
          return prev
        }
        return snapshot
      })
    }

    previousCountRef.current = currentCount
  }, [knowledgeBase, setKnowledgeBase])
}
