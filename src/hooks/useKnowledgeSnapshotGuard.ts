import { useEffect, useRef } from 'react'

import type { KnowledgeEntry } from '@/App'
import type { KVUpdater } from '@/hooks/useKV'

const cloneEntries = (entries: KnowledgeEntry[]): KnowledgeEntry[] =>
  entries.map(entry => ({
    ...entry,
    tags: [...entry.tags]
  }))

const LOCAL_STORAGE_SUFFIX = '.local'
const SNAPSHOT_CHUNK_DELIMITER = '::chunk::'
const SNAPSHOT_CHUNK_MANIFEST_FLAG = '__knowledgeSnapshotChunkManifest'
const SNAPSHOT_CHUNK_MANIFEST_VERSION = 1
const SNAPSHOT_CHUNK_SIZE_LIMIT = 250_000

type SnapshotChunkManifest = {
  [SNAPSHOT_CHUNK_MANIFEST_FLAG]: true
  version: number
  chunkCount: number
}

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

const buildSnapshotChunkKey = (baseKey: string, index: number): string =>
  `${baseKey}${SNAPSHOT_CHUNK_DELIMITER}${index}`

const isSnapshotChunkManifest = (candidate: unknown): candidate is SnapshotChunkManifest => {
  if (typeof candidate !== 'object' || candidate === null) {
    return false
  }

  const record = candidate as Record<string, unknown>
  return (
    record[SNAPSHOT_CHUNK_MANIFEST_FLAG] === true &&
    typeof record.chunkCount === 'number' &&
    Number.isFinite(record.chunkCount) &&
    record.chunkCount >= 0 &&
    typeof record.version === 'number' &&
    record.version === SNAPSHOT_CHUNK_MANIFEST_VERSION
  )
}

const tryParseSnapshotJSON = <T,>(value: string, label: string): T | null => {
  try {
    return JSON.parse(value) as T
  } catch (error) {
    console.warn(`[KnowledgeSnapshotGuard] Failed to parse persisted snapshot from ${label}`, error)
    return null
  }
}

const materializeEntries = (payload: unknown): KnowledgeEntry[] | null => {
  if (!Array.isArray(payload)) {
    return null
  }

  return payload
    .filter((entry): entry is KnowledgeEntry => typeof entry === 'object' && entry !== null)
    .map(entry => ({
      ...entry,
      tags: Array.isArray(entry.tags) ? [...entry.tags] : []
    }))
}

const readSnapshotFromStorage = (
  storage: Storage | null,
  key: string,
  label: 'sessionStorage' | 'localStorage'
): KnowledgeEntry[] | null => {
  if (!storage) {
    return null
  }

  try {
    const raw = storage.getItem(key)
    if (!raw) {
      return null
    }

    const parsed = tryParseSnapshotJSON<unknown>(raw, label)
    if (!parsed) {
      return null
    }

    if (isSnapshotChunkManifest(parsed)) {
      const chunks: string[] = []

      for (let index = 0; index < parsed.chunkCount; index += 1) {
        const chunkKey = buildSnapshotChunkKey(key, index)
        const chunk = storage.getItem(chunkKey)

        if (typeof chunk !== 'string') {
          console.warn(
            `[KnowledgeSnapshotGuard] Missing snapshot chunk ${index + 1}/${parsed.chunkCount} while reading ${label}.`
          )
          return null
        }

        chunks.push(chunk)
      }

      const serialized = chunks.join('')
      const chunkPayload = tryParseSnapshotJSON<unknown>(serialized, label)
      return materializeEntries(chunkPayload)
    }

    return materializeEntries(parsed)
  } catch (error) {
    console.warn(`[KnowledgeSnapshotGuard] Failed to read persisted snapshot from ${label}`, error)
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

const getStoredSnapshotManifest = (storage: Storage | null, key: string): SnapshotChunkManifest | null => {
  if (!storage) {
    return null
  }

  const raw = storage.getItem(key)
  if (!raw) {
    return null
  }

  const parsed = tryParseSnapshotJSON<unknown>(raw, 'manifest')
  if (parsed && isSnapshotChunkManifest(parsed)) {
    return parsed
  }

  return null
}

const removeSnapshotChunks = (
  storage: Storage,
  key: string,
  manifest?: SnapshotChunkManifest | null
): void => {
  const descriptor = manifest ?? getStoredSnapshotManifest(storage, key)
  if (!descriptor) {
    return
  }

  for (let index = 0; index < descriptor.chunkCount; index += 1) {
    const chunkKey = buildSnapshotChunkKey(key, index)
    try {
      storage.removeItem(chunkKey)
    } catch (error) {
      console.warn(
        `[KnowledgeSnapshotGuard] Failed to remove snapshot chunk ${index + 1}/${descriptor.chunkCount} for key "${key}"`,
        error
      )
    }
  }
}

const persistSerializedSnapshot = (
  storage: Storage | null,
  key: string,
  serialized: string,
  label: 'sessionStorage' | 'localStorage'
): void => {
  if (!storage) {
    return
  }

  try {
    const existingManifest = getStoredSnapshotManifest(storage, key)
    removeSnapshotChunks(storage, key, existingManifest)

    if (serialized.length <= SNAPSHOT_CHUNK_SIZE_LIMIT) {
      storage.setItem(key, serialized)
      return
    }

    const chunkCount = Math.ceil(serialized.length / SNAPSHOT_CHUNK_SIZE_LIMIT)
    const manifest: SnapshotChunkManifest = {
      [SNAPSHOT_CHUNK_MANIFEST_FLAG]: true,
      version: SNAPSHOT_CHUNK_MANIFEST_VERSION,
      chunkCount
    }

    const writtenChunks: string[] = []

    try {
      for (let index = 0; index < chunkCount; index += 1) {
        const start = index * SNAPSHOT_CHUNK_SIZE_LIMIT
        const chunk = serialized.slice(start, start + SNAPSHOT_CHUNK_SIZE_LIMIT)
        const chunkKey = buildSnapshotChunkKey(key, index)
        storage.setItem(chunkKey, chunk)
        writtenChunks.push(chunkKey)
      }

      storage.setItem(key, JSON.stringify(manifest))
    } catch (error) {
      for (const chunkKey of writtenChunks) {
        try {
          storage.removeItem(chunkKey)
        } catch {
          // Best-effort cleanup; the original write already logged the failure.
        }
      }

      throw error
    }
  } catch (error) {
    console.warn(`[KnowledgeSnapshotGuard] Failed to persist snapshot in ${label}`, error)
  }
}

const removeSnapshotFromStorage = (
  storage: Storage | null,
  key: string,
  label: 'sessionStorage' | 'localStorage'
): void => {
  if (!storage) {
    return
  }

  try {
    const manifest = getStoredSnapshotManifest(storage, key)
    storage.removeItem(key)
    removeSnapshotChunks(storage, key, manifest)
  } catch (error) {
    console.warn(`[KnowledgeSnapshotGuard] Failed to clear snapshot from ${label}`, error)
  }
}

const persistSnapshot = (storageKey: string, entries: KnowledgeEntry[]): void => {
  const serialized = JSON.stringify(entries)

  const sessionStorage = getStorage('sessionStorage')
  persistSerializedSnapshot(sessionStorage, storageKey, serialized, 'sessionStorage')

  const localStorage = getStorage('localStorage')
  persistSerializedSnapshot(localStorage, `${storageKey}${LOCAL_STORAGE_SUFFIX}`, serialized, 'localStorage')
}

const clearPersistedSnapshot = (storageKey: string): void => {
  const sessionStorage = getStorage('sessionStorage')
  removeSnapshotFromStorage(sessionStorage, storageKey, 'sessionStorage')

  const localStorage = getStorage('localStorage')
  removeSnapshotFromStorage(localStorage, `${storageKey}${LOCAL_STORAGE_SUFFIX}`, 'localStorage')
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
