import { useEffect, useRef } from 'react'

import type { KnowledgeEntry } from '@/App'
import type { KVUpdater } from '@/hooks/useKV'

const cloneEntries = (entries: KnowledgeEntry[]): KnowledgeEntry[] =>
  entries.map(entry => ({
    ...entry,
    tags: [...entry.tags]
  }))

const LOCAL_STORAGE_SUFFIX = '.local'

const getStorage = (label: 'sessionStorage' | 'localStorage'): Storage | null => {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window[label] ?? null
  } catch (error) {
    console.warn(`[KnowledgeSnapshotGuard] Unable to access ${label}`, error)
    return null
  }
}

const readSnapshotFromStorage = (storage: Storage | null, key: string, label: string): KnowledgeEntry[] | null => {
  if (!storage) {
    return null
  }

  try {
    const raw = storage.getItem(key)
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
    console.warn(`[KnowledgeSnapshotGuard] Failed to parse persisted snapshot from ${label}`, error)
    return null
  }
}

const readPersistedSnapshot = (storageKey: string): KnowledgeEntry[] | null => {
  const sessionStorage = getStorage('sessionStorage')
  const sessionSnapshot = readSnapshotFromStorage(sessionStorage, storageKey, 'sessionStorage')
  if (sessionSnapshot && sessionSnapshot.length > 0) {
    return sessionSnapshot
  }

  const localStorage = getStorage('localStorage')
  return readSnapshotFromStorage(localStorage, `${storageKey}${LOCAL_STORAGE_SUFFIX}`, 'localStorage')
}

const persistSnapshot = (storageKey: string, entries: KnowledgeEntry[]): void => {
  const serialized = JSON.stringify(entries)

  const sessionStorage = getStorage('sessionStorage')
  if (sessionStorage) {
    try {
      sessionStorage.setItem(storageKey, serialized)
    } catch (error) {
      console.warn('[KnowledgeSnapshotGuard] Failed to persist session snapshot', error)
    }
  }

  const localStorage = getStorage('localStorage')
  if (localStorage) {
    try {
      localStorage.setItem(`${storageKey}${LOCAL_STORAGE_SUFFIX}`, serialized)
    } catch (error) {
      console.warn('[KnowledgeSnapshotGuard] Failed to persist local snapshot backup', error)
    }
  }
}

const clearPersistedSnapshot = (storageKey: string): void => {
  const sessionStorage = getStorage('sessionStorage')
  if (sessionStorage) {
    try {
      sessionStorage.removeItem(storageKey)
    } catch (error) {
      console.warn('[KnowledgeSnapshotGuard] Failed to clear session snapshot', error)
    }
  }

  const localStorage = getStorage('localStorage')
  if (localStorage) {
    try {
      localStorage.removeItem(`${storageKey}${LOCAL_STORAGE_SUFFIX}`)
    } catch (error) {
      console.warn('[KnowledgeSnapshotGuard] Failed to clear local snapshot backup', error)
    }
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
  /**
   * When true, the guard attempts to restore the persisted snapshot during the first render
   * even if the empty state has not yet been classified as unexpected. This is useful for new
   * tabs that boot with an empty knowledge array but still have a local snapshot available.
   */
  restoreOnInitialLoad?: boolean
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
  const initialRestorationAttemptedRef = useRef(false)
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
  const restoreOnInitialLoadRef = useRef<boolean>(options?.restoreOnInitialLoad ?? false)

  if (getContextRef.current !== options?.getContext) {
    getContextRef.current = options?.getContext
  }

  if (isUnexpectedEmptyRef.current !== options?.isUnexpectedEmpty) {
    isUnexpectedEmptyRef.current = options?.isUnexpectedEmpty
  }

  if (restoreOnInitialLoadRef.current !== (options?.restoreOnInitialLoad ?? false)) {
    restoreOnInitialLoadRef.current = options?.restoreOnInitialLoad ?? false
  }

  useEffect(() => {
    const currentCount = Array.isArray(knowledgeBase) ? knowledgeBase.length : 0

    const shouldAttemptInitialRestore =
      restoreOnInitialLoadRef.current &&
      !initialRestorationAttemptedRef.current &&
      snapshotRef.current.length > 0

    if (shouldAttemptInitialRestore) {
      initialRestorationAttemptedRef.current = true

      if (currentCount === 0) {
        const snapshot = cloneEntries(snapshotRef.current)
        setKnowledgeBase(prev => {
          if (Array.isArray(prev) && prev.length > 0) {
            return prev
          }
          return snapshot
        })

        if (storageKeyRef.current) {
          persistSnapshot(storageKeyRef.current, snapshot)
        }
        previousCountRef.current = snapshot.length
        return
      }
    } else if (!initialRestorationAttemptedRef.current) {
      initialRestorationAttemptedRef.current = true
    }

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
