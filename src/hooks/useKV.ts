import { useCallback, useEffect, useRef, useState } from 'react'

import { fetchPersistedValue, savePersistedValue } from '@/lib/api/persistence'

type InitialValue<T> = T | (() => T)
type Updater<T> = T | ((previous: T) => T)

export type KVUpdater<T> = Updater<T>

const memoryStore = new Map<string, unknown>()

const STORAGE_PREFIX = 'eon.kv.'
const METADATA_PREFIX = `${STORAGE_PREFIX}meta.`

type StorageMetadata = {
  lastUpdatedAt: number
  lastSyncedAt: number | null
}

export type UseKVHydrationContext<T> = {
  key: string
  localValue: T | undefined
  metadata: StorageMetadata
  pendingSync: boolean
}

export type UseKVOptions<T> = {
  shouldAcceptHydration?: (incoming: T, context: UseKVHydrationContext<T>) => boolean
}

type StorageAdapter = {
  read<T>(key: string): T | undefined
  write<T>(key: string, value: T): void
  remove(key: string): void
  readMetadata(key: string): StorageMetadata | undefined
  writeMetadata(key: string, metadata: StorageMetadata): void
  removeMetadata(key: string): void
}

const buildDefaultAdapter = (): StorageAdapter => {
  if (typeof window === 'undefined') {
    return {
      read: () => undefined,
      write: () => {},
      remove: () => {},
      readMetadata: () => undefined,
      writeMetadata: () => {},
      removeMetadata: () => {}
    }
  }

  return {
    read: <T,>(key: string): T | undefined => {
      try {
        const raw = window.localStorage?.getItem(`${STORAGE_PREFIX}${key}`)
        if (raw === null || raw === undefined) {
          return undefined
        }

        return JSON.parse(raw) as T
      } catch (error) {
        console.warn(`[useKV] Failed to parse browser storage for key "${key}"`, error)
        return undefined
      }
    },
    write: <T,>(key: string, value: T): void => {
      try {
        window.localStorage?.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value))
      } catch (error) {
        console.warn(`[useKV] Failed to persist browser storage value for key "${key}"`, error)
      }
    },
    remove: (key: string): void => {
      try {
        window.localStorage?.removeItem(`${STORAGE_PREFIX}${key}`)
      } catch (error) {
        console.warn(`[useKV] Failed to remove browser storage value for key "${key}"`, error)
      }
    },
    readMetadata: (key: string): StorageMetadata | undefined => {
      try {
        const raw = window.localStorage?.getItem(`${METADATA_PREFIX}${key}`)
        if (!raw) {
          return undefined
        }

        const parsed = JSON.parse(raw) as Partial<StorageMetadata>
        if (typeof parsed?.lastUpdatedAt !== 'number') {
          return undefined
        }

        const lastSyncedAt =
          typeof parsed.lastSyncedAt === 'number' ? parsed.lastSyncedAt : null

        return {
          lastUpdatedAt: parsed.lastUpdatedAt,
          lastSyncedAt
        }
      } catch (error) {
        console.warn(`[useKV] Failed to parse browser storage metadata for key "${key}"`, error)
        return undefined
      }
    },
    writeMetadata: (key: string, metadata: StorageMetadata): void => {
      try {
        window.localStorage?.setItem(`${METADATA_PREFIX}${key}`, JSON.stringify(metadata))
      } catch (error) {
        console.warn(`[useKV] Failed to persist browser storage metadata for key "${key}"`, error)
      }
    },
    removeMetadata: (key: string): void => {
      try {
        window.localStorage?.removeItem(`${METADATA_PREFIX}${key}`)
      } catch (error) {
        console.warn(`[useKV] Failed to remove browser storage metadata for key "${key}"`, error)
      }
    }
  }
}

let storageAdapter: StorageAdapter = buildDefaultAdapter()

const readFromAdapter = <T,>(key: string): T | undefined => {
  try {
    return storageAdapter.read<T>(key)
  } catch (error) {
    console.warn(`[useKV] Storage adapter read failed for key "${key}"`, error)
    return undefined
  }
}

const writeToAdapter = <T,>(key: string, value: T): void => {
  try {
    storageAdapter.write<T>(key, value)
  } catch (error) {
    console.warn(`[useKV] Storage adapter write failed for key "${key}"`, error)
  }
}

const removeFromAdapter = (key: string): void => {
  try {
    storageAdapter.remove(key)
  } catch (error) {
    console.warn(`[useKV] Storage adapter remove failed for key "${key}"`, error)
  }
}

const readMetadataFromAdapter = (key: string): StorageMetadata | undefined => {
  try {
    return storageAdapter.readMetadata(key)
  } catch (error) {
    console.warn(`[useKV] Storage adapter metadata read failed for key "${key}"`, error)
    return undefined
  }
}

const writeMetadataToAdapter = (key: string, metadata: StorageMetadata): void => {
  try {
    storageAdapter.writeMetadata(key, metadata)
  } catch (error) {
    console.warn(`[useKV] Storage adapter metadata write failed for key "${key}"`, error)
  }
}

const removeMetadataFromAdapter = (key: string): void => {
  try {
    storageAdapter.removeMetadata(key)
  } catch (error) {
    console.warn(`[useKV] Storage adapter metadata remove failed for key "${key}"`, error)
  }
}

const DEFAULT_METADATA: StorageMetadata = { lastUpdatedAt: 0, lastSyncedAt: null }

export const setKVStorageAdapter = (adapter?: StorageAdapter): void => {
  storageAdapter = adapter ?? buildDefaultAdapter()
}

const resolveInitial = <T,>(value: InitialValue<T>): T =>
  typeof value === 'function' ? (value as () => T)() : value

const ensureMemoryValue = <T,>(key: string, fallback: T): T => {
  if (memoryStore.has(key)) {
    return memoryStore.get(key) as T
  }
  memoryStore.set(key, fallback)
  return fallback
}

export function useKV<T>(
  key: string,
  defaultValue: InitialValue<T>,
  options?: UseKVOptions<T>
): [T, (value: Updater<T>) => void] {
  const keyRef = useRef(key)
  const defaultSourceRef = useRef<InitialValue<T>>(defaultValue)
  const defaultValueRef = useRef<T>(resolveInitial(defaultValue))
  const revisionRef = useRef(0)
  const hasLocalWriteRef = useRef(false)
  const metadataRef = useRef<StorageMetadata>({ ...DEFAULT_METADATA })
  const metadataInitializedRef = useRef(false)
  const hasPendingSyncRef = useRef(false)
  const optionsRef = useRef<UseKVOptions<T> | undefined>(options)

  if (keyRef.current !== key) {
    keyRef.current = key
    defaultSourceRef.current = defaultValue
    defaultValueRef.current = resolveInitial(defaultValue)
    revisionRef.current = 0
    hasLocalWriteRef.current = false
    metadataRef.current = { ...DEFAULT_METADATA }
    metadataInitializedRef.current = false
    hasPendingSyncRef.current = false
    optionsRef.current = options
  } else if (defaultSourceRef.current !== defaultValue) {
    defaultSourceRef.current = defaultValue
    const resolvedDefault = resolveInitial(defaultValue)
    if (!Object.is(defaultValueRef.current, resolvedDefault)) {
      defaultValueRef.current = resolvedDefault
    }
  }

  if (optionsRef.current !== options) {
    optionsRef.current = options
  }

  if (!metadataInitializedRef.current) {
    metadataInitializedRef.current = true
    const storedMetadata = readMetadataFromAdapter(keyRef.current)
    if (storedMetadata) {
      metadataRef.current = storedMetadata
      hasPendingSyncRef.current =
        storedMetadata.lastSyncedAt === null || storedMetadata.lastSyncedAt < storedMetadata.lastUpdatedAt
    } else {
      metadataRef.current = { ...DEFAULT_METADATA }
      hasPendingSyncRef.current = false
    }
  }

  const [value, setValue] = useState<T>(() => {
    if (memoryStore.has(keyRef.current)) {
      return memoryStore.get(keyRef.current) as T
    }

    const mirrored = readFromAdapter<T>(keyRef.current)
    if (mirrored !== undefined) {
      memoryStore.set(keyRef.current, mirrored)
      return mirrored
    }

    const ensured = ensureMemoryValue(keyRef.current, defaultValueRef.current)
    writeToAdapter(keyRef.current, ensured)
    return ensured
  })

  const markPendingSync = (timestamp: number) => {
    metadataRef.current = {
      lastUpdatedAt: timestamp,
      lastSyncedAt: metadataRef.current.lastSyncedAt
    }
    hasPendingSyncRef.current = true
    writeMetadataToAdapter(keyRef.current, metadataRef.current)
  }

  const markSyncedIfCurrent = (timestamp: number) => {
    if (metadataRef.current.lastUpdatedAt !== timestamp) {
      return
    }

    metadataRef.current = {
      lastUpdatedAt: timestamp,
      lastSyncedAt: timestamp
    }
    hasPendingSyncRef.current = false
    writeMetadataToAdapter(keyRef.current, metadataRef.current)
  }

  const pushToPersistence = (payload: T, timestamp: number): void => {
    void savePersistedValue(keyRef.current, payload)
      .then(() => {
        markSyncedIfCurrent(timestamp)
      })
      .catch(error => {
        console.warn(`[useKV] Failed to persist value for key "${keyRef.current}"`, error)
      })
  }

  const attemptResync = (payload: T): void => {
    const timestamp = metadataRef.current.lastUpdatedAt || Date.now()
    markPendingSync(timestamp)
    pushToPersistence(payload, timestamp)
  }

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const loadRevision = revisionRef.current
      const stored = await fetchPersistedValue<T>(key)

      const fallback = defaultValueRef.current
      const pendingSync = hasPendingSyncRef.current

      if (stored === undefined || (stored === null && fallback !== null)) {
        const mirrored = readFromAdapter<T>(key)
        if (mirrored !== undefined) {
          memoryStore.set(key, mirrored)
          if (!cancelled) {
            setValue(mirrored)
          }
          if (pendingSync) {
            attemptResync(mirrored)
          }
          return
        }

        if (!memoryStore.has(key)) {
          memoryStore.set(key, fallback)
          writeToAdapter(key, fallback)
          const timestamp = Date.now()
          markPendingSync(timestamp)
          try {
            await savePersistedValue(key, fallback)
            markSyncedIfCurrent(timestamp)
          } catch {
            // Persistence layer will log failures; keep pending flag for retries.
          }
          if (!cancelled) {
            setValue(fallback)
          }
        } else if (!cancelled) {
          const existing = memoryStore.get(key) as T
          setValue(existing)
          if (pendingSync) {
            attemptResync(existing)
          }
        }

        if (stored === null && fallback !== null) {
          console.warn(
            `[useKV] Received null for key "${key}"; falling back to default value. ` +
              'Consider ensuring the persistence layer does not emit null for this key.'
          )
        }

        return
      }

      if (pendingSync) {
        const localValue = memoryStore.has(key)
          ? (memoryStore.get(key) as T)
          : readFromAdapter<T>(key)

        if (localValue !== undefined) {
          console.info(
            `[useKV] Skipping server hydration for key "${key}" because local mirror has unsynced updates.`
          )
          attemptResync(localValue)
          if (!cancelled) {
            setValue(localValue)
          }
        }
        return
      }

      if ((hasLocalWriteRef.current && revisionRef.current >= loadRevision) || revisionRef.current !== loadRevision) {
        return
      }

      const localValue = memoryStore.has(key)
        ? (memoryStore.get(key) as T)
        : readFromAdapter<T>(key)

      const shouldAcceptHydration = optionsRef.current?.shouldAcceptHydration
        ? optionsRef.current.shouldAcceptHydration(stored, {
            key,
            localValue,
            metadata: metadataRef.current,
            pendingSync
          })
        : true

      if (!shouldAcceptHydration) {
        console.warn(
          `[useKV] Rejected hydration for key "${key}" because the incoming payload failed the acceptance predicate.`
        )

        if (localValue !== undefined) {
          attemptResync(localValue)
          if (!cancelled) {
            setValue(localValue)
          }
        }

        return
      }

      memoryStore.set(key, stored)
      writeToAdapter(key, stored)
      const timestamp = Date.now()
      metadataRef.current = { lastUpdatedAt: timestamp, lastSyncedAt: timestamp }
      hasPendingSyncRef.current = false
      writeMetadataToAdapter(key, metadataRef.current)
      if (!cancelled) {
        setValue(stored)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [key])

  const update = useCallback(
    (nextValue: Updater<T>) => {
      setValue(prev => {
        const resolved = typeof nextValue === 'function' ? (nextValue as (previous: T) => T)(prev) : nextValue
        revisionRef.current += 1
        hasLocalWriteRef.current = true
        memoryStore.set(keyRef.current, resolved)
        writeToAdapter(keyRef.current, resolved)
        const timestamp = Date.now()
        markPendingSync(timestamp)
        pushToPersistence(resolved, timestamp)
        return resolved
      })
    },
    []
  )

  return [value, update]
}

export function clearKVStore(): void {
  for (const key of memoryStore.keys()) {
    removeFromAdapter(key)
    removeMetadataFromAdapter(key)
  }
  memoryStore.clear()
  // Optionally clear server-side store by removing known keys
  // but since keys are dynamic we only reset local cache here.
}
