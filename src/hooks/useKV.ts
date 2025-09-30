import { useCallback, useEffect, useRef, useState } from 'react'

import { fetchPersistedValue, savePersistedValue } from '@/lib/api/persistence'

type InitialValue<T> = T | (() => T)
type Updater<T> = T | ((previous: T) => T)

export type KVUpdater<T> = Updater<T>

const memoryStore = new Map<string, unknown>()

const STORAGE_PREFIX = 'eon.kv.'

type StorageAdapter = {
  read<T>(key: string): T | undefined
  write<T>(key: string, value: T): void
  remove(key: string): void
}

const buildDefaultAdapter = (): StorageAdapter => {
  if (typeof window === 'undefined') {
    return {
      read: () => undefined,
      write: () => {},
      remove: () => {}
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

export function useKV<T>(key: string, defaultValue: InitialValue<T>): [T, (value: Updater<T>) => void] {
  const keyRef = useRef(key)
  const defaultSourceRef = useRef<InitialValue<T>>(defaultValue)
  const defaultValueRef = useRef<T>(resolveInitial(defaultValue))
  const revisionRef = useRef(0)
  const hasLocalWriteRef = useRef(false)

  if (keyRef.current !== key) {
    keyRef.current = key
    defaultSourceRef.current = defaultValue
    defaultValueRef.current = resolveInitial(defaultValue)
    revisionRef.current = 0
    hasLocalWriteRef.current = false
  } else if (defaultSourceRef.current !== defaultValue) {
    defaultSourceRef.current = defaultValue
    const resolvedDefault = resolveInitial(defaultValue)
    if (!Object.is(defaultValueRef.current, resolvedDefault)) {
      defaultValueRef.current = resolvedDefault
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

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const loadRevision = revisionRef.current
      const stored = await fetchPersistedValue<T>(key)

      const fallback = defaultValueRef.current

      if (stored === undefined || (stored === null && fallback !== null)) {
        const mirrored = readFromAdapter<T>(key)
        if (mirrored !== undefined) {
          memoryStore.set(key, mirrored)
          if (!cancelled) {
            setValue(mirrored)
          }
          return
        }

        if (!memoryStore.has(key)) {
          memoryStore.set(key, fallback)
          await savePersistedValue(key, fallback)
          writeToAdapter(key, fallback)
          if (!cancelled) {
            setValue(fallback)
          }
        } else if (!cancelled) {
          setValue(memoryStore.get(key) as T)
        }

        if (stored === null && fallback !== null) {
          console.warn(
            `[useKV] Received null for key "${key}"; falling back to default value. ` +
              'Consider ensuring the persistence layer does not emit null for this key.'
          )
        }

        return
      }

      if ((hasLocalWriteRef.current && revisionRef.current >= loadRevision) || revisionRef.current !== loadRevision) {
        return
      }

      memoryStore.set(key, stored)
      writeToAdapter(key, stored)
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
        void savePersistedValue(keyRef.current, resolved)
        writeToAdapter(keyRef.current, resolved)
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
  }
  memoryStore.clear()
  // Optionally clear server-side store by removing known keys
  // but since keys are dynamic we only reset local cache here.
}
