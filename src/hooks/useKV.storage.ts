export const STORAGE_PREFIX = 'eon.kv.'
export const METADATA_PREFIX = `${STORAGE_PREFIX}meta.`

export type StorageMetadata = {
  lastUpdatedAt: number
  lastSyncedAt: number | null
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

export const DEFAULT_METADATA: StorageMetadata = { lastUpdatedAt: 0, lastSyncedAt: null }

export const setKVStorageAdapter = (adapter?: StorageAdapter): void => {
  storageAdapter = adapter ?? buildDefaultAdapter()
}

export const readFromAdapter = <T,>(key: string): T | undefined => {
  try {
    return storageAdapter.read<T>(key)
  } catch (error) {
    console.warn(`[useKV] Storage adapter read failed for key "${key}"`, error)
    return undefined
  }
}

export const writeToAdapter = <T,>(key: string, value: T): void => {
  try {
    storageAdapter.write<T>(key, value)
  } catch (error) {
    console.warn(`[useKV] Storage adapter write failed for key "${key}"`, error)
  }
}

export const removeFromAdapter = (key: string): void => {
  try {
    storageAdapter.remove(key)
  } catch (error) {
    console.warn(`[useKV] Storage adapter remove failed for key "${key}"`, error)
  }
}

export const readMetadataFromAdapter = (key: string): StorageMetadata | undefined => {
  try {
    return storageAdapter.readMetadata(key)
  } catch (error) {
    console.warn(`[useKV] Storage adapter metadata read failed for key "${key}"`, error)
    return undefined
  }
}

export const writeMetadataToAdapter = (key: string, metadata: StorageMetadata): void => {
  try {
    storageAdapter.writeMetadata(key, metadata)
  } catch (error) {
    console.warn(`[useKV] Storage adapter metadata write failed for key "${key}"`, error)
  }
}

export const removeMetadataFromAdapter = (key: string): void => {
  try {
    storageAdapter.removeMetadata(key)
  } catch (error) {
    console.warn(`[useKV] Storage adapter metadata remove failed for key "${key}"`, error)
  }
}

