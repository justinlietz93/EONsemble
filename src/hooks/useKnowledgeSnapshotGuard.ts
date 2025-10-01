import { useEffect, useRef } from 'react'

import type { KnowledgeEntry } from '@/App'
import type { KVUpdater } from '@/hooks/useKV'

const cloneEntries = (entries: KnowledgeEntry[]): KnowledgeEntry[] =>
  entries.map(entry => ({
    ...entry,
    tags: [...entry.tags]
  }))

const readPersistedSnapshot = (storageKey: string): KnowledgeEntry[] | null => {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.sessionStorage?.getItem(storageKey)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return null
    }

    return parsed
      .filter((entry): entry is KnowledgeEntry => typeof entry === 'object' && entry !== null)
      .map(entry => ({
        ...entry,
        tags: Array.isArray(entry.tags) ? [...entry.tags] : []
      }))
  } catch (error) {
    console.warn('[KnowledgeSnapshotGuard] Failed to parse persisted session snapshot', error)
    return null
  }
}

const persistSnapshot = (storageKey: string, entries: KnowledgeEntry[]): void => {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.sessionStorage?.setItem(storageKey, JSON.stringify(entries))
  } catch (error) {
    console.warn('[KnowledgeSnapshotGuard] Failed to persist session snapshot', error)
  }
}

const clearPersistedSnapshot = (storageKey: string): void => {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.sessionStorage?.removeItem(storageKey)
  } catch (error) {
    console.warn('[KnowledgeSnapshotGuard] Failed to clear session snapshot', error)
  }
}

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
  /**
   * Optional sessionStorage key used to persist the snapshot across component remounts.
   */
  storageKey?: string
}

export function useKnowledgeSnapshotGuard(
  knowledgeBase: KnowledgeEntry[] | undefined,
  setKnowledgeBase: (updater: KVUpdater<KnowledgeEntry[]>) => void,
  options?: GuardOptions
): void {
  const storageKeyRef = useRef<string | null>(options?.storageKey ?? null)
  if (storageKeyRef.current !== (options?.storageKey ?? null)) {
    storageKeyRef.current = options?.storageKey ?? null
  }

  const snapshotRef = useRef<KnowledgeEntry[]>([])
  const previousCountRef = useRef<number>(0)
  const initializedRef = useRef(false)
  if (!initializedRef.current) {
    if (Array.isArray(knowledgeBase) && knowledgeBase.length > 0) {
      snapshotRef.current = cloneEntries(knowledgeBase)
      previousCountRef.current = knowledgeBase.length
    } else if (storageKeyRef.current) {
      const persisted = readPersistedSnapshot(storageKeyRef.current)
      if (persisted && persisted.length > 0) {
        snapshotRef.current = cloneEntries(persisted)
        previousCountRef.current = persisted.length
      }
    }

    initializedRef.current = true
  }
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
      const cloned = cloneEntries(knowledgeBase)
      snapshotRef.current = cloned
      previousCountRef.current = currentCount
      if (storageKeyRef.current) {
        persistSnapshot(storageKeyRef.current, cloned)
      }
      return
    }

    const storageKey = storageKeyRef.current
    if (currentCount === 0 && storageKey && snapshotRef.current.length === 0) {
      const persisted = readPersistedSnapshot(storageKey)
      if (persisted && persisted.length > 0) {
        snapshotRef.current = cloneEntries(persisted)
      }
    }

    const hadPreviousEntries = previousCountRef.current > 0 || snapshotRef.current.length > 0
    const hasSnapshot = snapshotRef.current.length > 0
    const isUnexpectedEmpty =
      typeof isUnexpectedEmptyRef.current === 'function'
        ? isUnexpectedEmptyRef.current()
        : hadPreviousEntries

    if (currentCount === 0 && !isUnexpectedEmpty) {
      if (storageKey) {
        clearPersistedSnapshot(storageKey)
      }
      snapshotRef.current = []
      previousCountRef.current = 0
      return
    }

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

      if (storageKey) {
        persistSnapshot(storageKey, snapshot)
      }
      previousCountRef.current = snapshot.length
      return
    }

    previousCountRef.current = currentCount
  }, [knowledgeBase, setKnowledgeBase])
}
