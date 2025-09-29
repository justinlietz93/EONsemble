import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { fetchPersistedValue, savePersistedValue } from '@/lib/api/persistence'

type InitialValue<T> = T | (() => T)
type Updater<T> = T | ((previous: T) => T)

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
  keyRef.current = key

  const resolvedDefault = useMemo(() => resolveInitial(defaultValue), [defaultValue])

  const [value, setValue] = useState<T>(() => ensureMemoryValue(key, resolvedDefault))

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const stored = await fetchPersistedValue<T>(key)
      if (stored === undefined) {
        memoryStore.set(key, resolvedDefault)
        await savePersistedValue(key, resolvedDefault)
        if (!cancelled) {
          setValue(resolvedDefault)
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
  }, [key, resolvedDefault])

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
