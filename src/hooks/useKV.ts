import { useCallback, useEffect, useRef, useState } from 'react'

import { fetchPersistedValue, savePersistedValue } from '@/lib/api/persistence'

import {
  DEFAULT_METADATA,
  METADATA_PREFIX,
  STORAGE_PREFIX,
  readFromAdapter,
  readMetadataFromAdapter,
  removeFromAdapter,
  removeMetadataFromAdapter,
  writeMetadataToAdapter,
  writeToAdapter,
  type StorageMetadata
} from './useKV.storage'

export { setKVStorageAdapter } from './useKV.storage'

type InitialValue<T> = T | (() => T)
type Updater<T> = T | ((previous: T) => T)

export type KVUpdater<T> = Updater<T>

const memoryStore = new Map<string, unknown>()

export type UseKVHydrationContext<T> = {
  key: string
  localValue: T | undefined
  metadata: StorageMetadata
  pendingSync: boolean
}

export type UseKVOptions<T> = {
  shouldAcceptHydration?: (incoming: T, context: UseKVHydrationContext<T>) => boolean
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
        const localOrMirror = memoryStore.has(key)
          ? (memoryStore.get(key) as T)
          : readFromAdapter<T>(key)

        if (localOrMirror !== undefined) {
          memoryStore.set(key, localOrMirror)
          if (!cancelled) {
            setValue(localOrMirror)
          }

          if (stored === null) {
            console.warn(
              `[useKV] Received null for key "${key}"; replaying preserved local state back to persistence.`
            )
          }

          const previouslySynced = metadataRef.current.lastSyncedAt !== null
          if (
            hasPendingSyncRef.current ||
            stored === null ||
            (stored === undefined && previouslySynced)
          ) {
            attemptResync(localOrMirror)
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
          if (hasPendingSyncRef.current || stored === null) {
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

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage) {
        return
      }

      const dataKey = `${STORAGE_PREFIX}${keyRef.current}`
      const metadataKey = `${METADATA_PREFIX}${keyRef.current}`

      if (event.key === dataKey) {
        if (event.newValue === null) {
          const fallback = resolveInitial(defaultSourceRef.current)
          memoryStore.set(keyRef.current, fallback)
          revisionRef.current += 1
          metadataRef.current = { ...DEFAULT_METADATA }
          hasPendingSyncRef.current = false
          setValue(fallback)
          return
        }

        let incoming: T | undefined

        try {
          incoming = readFromAdapter<T>(keyRef.current)
          if (incoming === undefined) {
            incoming = JSON.parse(event.newValue) as T
          }
        } catch (error) {
          console.warn(
            `[useKV] Failed to parse storage event payload for key "${keyRef.current}"`,
            error
          )
          return
        }

        if (incoming === undefined) {
          return
        }

        const localValue = memoryStore.has(keyRef.current)
          ? (memoryStore.get(keyRef.current) as T)
          : undefined

        const shouldAccept = optionsRef.current?.shouldAcceptHydration
          ? optionsRef.current.shouldAcceptHydration(incoming, {
              key: keyRef.current,
              localValue,
              metadata: metadataRef.current,
              pendingSync: hasPendingSyncRef.current
            })
          : true

        if (!shouldAccept) {
          return
        }

        memoryStore.set(keyRef.current, incoming)
        revisionRef.current += 1
        setValue(incoming)

        const latestMetadata = readMetadataFromAdapter(keyRef.current)
        if (latestMetadata) {
          metadataRef.current = latestMetadata
          hasPendingSyncRef.current =
            latestMetadata.lastSyncedAt === null ||
            latestMetadata.lastSyncedAt < latestMetadata.lastUpdatedAt
        }

        return
      }

      if (event.key === metadataKey) {
        if (!event.newValue) {
          metadataRef.current = { ...DEFAULT_METADATA }
          hasPendingSyncRef.current = false
          return
        }

        try {
          const parsed = JSON.parse(event.newValue) as Partial<StorageMetadata>
          if (typeof parsed?.lastUpdatedAt === 'number') {
            const lastSyncedAt =
              typeof parsed.lastSyncedAt === 'number' ? parsed.lastSyncedAt : null
            metadataRef.current = {
              lastUpdatedAt: parsed.lastUpdatedAt,
              lastSyncedAt
            }
            hasPendingSyncRef.current =
              lastSyncedAt === null || lastSyncedAt < parsed.lastUpdatedAt
          }
        } catch (error) {
          console.warn(
            `[useKV] Failed to parse storage event metadata for key "${keyRef.current}"`,
            error
          )
        }
      }
    }

    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

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
