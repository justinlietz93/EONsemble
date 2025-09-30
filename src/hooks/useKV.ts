import { useCallback, useEffect, useRef, useState } from 'react'

import { fetchPersistedValue, savePersistedValue } from '@/lib/api/persistence'

type InitialValue<T> = T | (() => T)
type Updater<T> = T | ((previous: T) => T)

export type KVUpdater<T> = Updater<T>

const memoryStore = new Map<string, unknown>()

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

  if (keyRef.current !== key || defaultSourceRef.current !== defaultValue) {
    keyRef.current = key
    defaultSourceRef.current = defaultValue
    defaultValueRef.current = resolveInitial(defaultValue)
  }

  const [value, setValue] = useState<T>(() => ensureMemoryValue(keyRef.current, defaultValueRef.current))

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const stored = await fetchPersistedValue<T>(key)

      const fallback = defaultValueRef.current

      if (stored === undefined || (stored === null && fallback !== null)) {
        if (!memoryStore.has(key)) {
          memoryStore.set(key, fallback)
          await savePersistedValue(key, fallback)
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

      memoryStore.set(key, stored)
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
        memoryStore.set(keyRef.current, resolved)
        void savePersistedValue(keyRef.current, resolved)
        return resolved
      })
    },
    []
  )

  return [value, update]
}

export function clearKVStore(): void {
  memoryStore.clear()
  // Optionally clear server-side store by removing known keys
  // but since keys are dynamic we only reset local cache here.
}
