export const STORAGE_PREFIX = 'eon.kv.'
export const METADATA_PREFIX = `${STORAGE_PREFIX}meta.`
const CHUNK_PREFIX = `${STORAGE_PREFIX}chunk.`

const CHUNK_DELIMITER = '::'
const CHUNK_MANIFEST_FLAG = '__eonKvChunkManifest'
const CHUNK_MANIFEST_VERSION = 1
const CHUNK_SIZE_LIMIT = 250_000

type ChunkManifest = {
  [CHUNK_MANIFEST_FLAG]: true
  version: number
  chunkCount: number
}

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

const buildDataKey = (key: string): string => `${STORAGE_PREFIX}${key}`

const buildChunkKey = (key: string, index: number): string =>
  `${CHUNK_PREFIX}${key}${CHUNK_DELIMITER}${index}`

const getLocalStorage = (): Storage | null => {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage ?? null
  } catch (error) {
    console.warn('[useKV] Unable to access localStorage', error)
    return null
  }
}

const getSessionStorage = (): Storage | null => {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.sessionStorage ?? null
  } catch (error) {
    console.warn('[useKV] Unable to access sessionStorage', error)
    return null
  }
}

const tryParseJSON = <T>(value: string): T | null => {
  try {
    return JSON.parse(value) as T
  } catch (error) {
    console.warn('[useKV] Failed to parse JSON payload from browser storage', error)
    return null
  }
}

const isChunkManifest = (candidate: unknown): candidate is ChunkManifest => {
  if (typeof candidate !== 'object' || candidate === null) {
    return false
  }

  const record = candidate as Record<string, unknown>
  return (
    record[CHUNK_MANIFEST_FLAG] === true &&
    typeof record.chunkCount === 'number' &&
    Number.isFinite(record.chunkCount) &&
    record.chunkCount >= 0 &&
    typeof record.version === 'number' &&
    record.version === CHUNK_MANIFEST_VERSION
  )
}

const readChunkedValue = <T,>(storage: Storage, key: string, manifest: ChunkManifest): T | undefined => {
  const chunks: string[] = []

  for (let index = 0; index < manifest.chunkCount; index += 1) {
    const chunkKey = buildChunkKey(key, index)
    const chunk = storage.getItem(chunkKey)

    if (typeof chunk !== 'string') {
      console.warn(
        `[useKV] Missing chunk ${index + 1}/${manifest.chunkCount} while reading key "${key}" from browser storage.`
      )
      return undefined
    }

    chunks.push(chunk)
  }

  const serialized = chunks.join('')
  const parsed = tryParseJSON<T>(serialized)
  return parsed ?? undefined
}

const getStoredChunkManifest = (storage: Storage | null, key: string): ChunkManifest | null => {
  if (!storage) {
    return null
  }

  try {
    const raw = storage.getItem(buildDataKey(key))
    if (!raw) {
      return null
    }

    const parsed = tryParseJSON<unknown>(raw)
    if (!parsed || !isChunkManifest(parsed)) {
      return null
    }

    return parsed
  } catch (error) {
    console.warn(`[useKV] Failed to read chunk manifest for key "${key}"`, error)
    return null
  }
}

const removeChunkEntries = (storage: Storage | null, key: string, manifest?: ChunkManifest | null): void => {
  if (!storage) {
    return
  }

  const descriptor = manifest ?? getStoredChunkManifest(storage, key)
  if (!descriptor) {
    return
  }

  for (let index = 0; index < descriptor.chunkCount; index += 1) {
    const chunkKey = buildChunkKey(key, index)
    try {
      storage.removeItem(chunkKey)
    } catch (error) {
      console.warn(
        `[useKV] Failed to remove chunk ${index + 1}/${descriptor.chunkCount} for key "${key}" during cleanup.`,
        error
      )
    }
  }
}

const writeChunkedValue = <T,>(storage: Storage, key: string, serialized: string): void => {
  const chunkCount = Math.ceil(serialized.length / CHUNK_SIZE_LIMIT)
  const manifest: ChunkManifest = {
    [CHUNK_MANIFEST_FLAG]: true,
    version: CHUNK_MANIFEST_VERSION,
    chunkCount
  }

  const writtenChunks: string[] = []

  try {
    for (let index = 0; index < chunkCount; index += 1) {
      const start = index * CHUNK_SIZE_LIMIT
      const chunk = serialized.slice(start, start + CHUNK_SIZE_LIMIT)
      const chunkKey = buildChunkKey(key, index)
      storage.setItem(chunkKey, chunk)
      writtenChunks.push(chunkKey)
    }

    storage.setItem(buildDataKey(key), JSON.stringify(manifest))
  } catch (error) {
    for (const chunkKey of writtenChunks) {
      try {
        storage.removeItem(chunkKey)
      } catch {
        // Partial cleanup best-effort; the warning for the failure was already emitted by the caller.
      }
    }

    throw error
  }
}

const readValueFromStorage = <T,>(storage: Storage | null, key: string): T | undefined => {
  if (!storage) {
    return undefined
  }

  try {
    const raw = storage.getItem(buildDataKey(key))
    if (raw === null || raw === undefined) {
      return undefined
    }

    const parsed = tryParseJSON<unknown>(raw)
    if (parsed && isChunkManifest(parsed)) {
      return readChunkedValue<T>(storage, key, parsed) ?? undefined
    }

    return (parsed as T) ?? undefined
  } catch (error) {
    console.warn(`[useKV] Failed to read browser storage value for key "${key}"`, error)
    return undefined
  }
}

const persistSerializedValue = (
  storage: Storage | null,
  key: string,
  serialized: string,
  label: 'localStorage' | 'sessionStorage'
): void => {
  if (!storage) {
    return
  }

  try {
    const manifest = getStoredChunkManifest(storage, key)
    removeChunkEntries(storage, key, manifest)

    if (serialized.length > CHUNK_SIZE_LIMIT) {
      writeChunkedValue(storage, key, serialized)
      return
    }

    storage.setItem(buildDataKey(key), serialized)
  } catch (error) {
    console.warn(`[useKV] Failed to persist browser storage value for key "${key}" in ${label}`, error)
  }
}

const removeValueFromStorage = (
  storage: Storage | null,
  key: string,
  label: 'localStorage' | 'sessionStorage'
): void => {
  if (!storage) {
    return
  }

  try {
    const manifest = getStoredChunkManifest(storage, key)
    storage.removeItem(buildDataKey(key))
    removeChunkEntries(storage, key, manifest)
  } catch (error) {
    console.warn(`[useKV] Failed to remove browser storage value for key "${key}" from ${label}`, error)
  }
}

const readMetadataFromStorage = (
  storage: Storage | null,
  key: string,
  label: 'localStorage' | 'sessionStorage'
): StorageMetadata | undefined => {
  if (!storage) {
    return undefined
  }

  try {
    const raw = storage.getItem(`${METADATA_PREFIX}${key}`)
    if (!raw) {
      return undefined
    }

    const parsed = JSON.parse(raw) as Partial<StorageMetadata>
    if (typeof parsed?.lastUpdatedAt !== 'number') {
      return undefined
    }

    const lastSyncedAt = typeof parsed.lastSyncedAt === 'number' ? parsed.lastSyncedAt : null
    return { lastUpdatedAt: parsed.lastUpdatedAt, lastSyncedAt }
  } catch (error) {
    console.warn(`[useKV] Failed to parse browser storage metadata for key "${key}" in ${label}`, error)
    return undefined
  }
}

const writeMetadataToStorage = (
  storage: Storage | null,
  key: string,
  metadata: StorageMetadata,
  label: 'localStorage' | 'sessionStorage'
): void => {
  if (!storage) {
    return
  }

  try {
    storage.setItem(`${METADATA_PREFIX}${key}`, JSON.stringify(metadata))
  } catch (error) {
    console.warn(`[useKV] Failed to persist browser storage metadata for key "${key}" in ${label}`, error)
  }
}

const removeMetadataFromStorage = (
  storage: Storage | null,
  key: string,
  label: 'localStorage' | 'sessionStorage'
): void => {
  if (!storage) {
    return
  }

  try {
    storage.removeItem(`${METADATA_PREFIX}${key}`)
  } catch (error) {
    console.warn(`[useKV] Failed to remove browser storage metadata for key "${key}" from ${label}`, error)
  }
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
      const localStorageRef = getLocalStorage()
      const localValue = readValueFromStorage<T>(localStorageRef, key)
      if (localValue !== undefined) {
        return localValue
      }

      const sessionStorageRef = getSessionStorage()
      const sessionValue = readValueFromStorage<T>(sessionStorageRef, key)
      if (sessionValue !== undefined && localStorageRef) {
        try {
          const serialized = JSON.stringify(sessionValue)
          if (typeof serialized === 'string') {
            persistSerializedValue(localStorageRef, key, serialized, 'localStorage')
          }
        } catch (error) {
          console.warn(
            `[useKV] Failed to backfill localStorage from sessionStorage for key "${key}"`,
            error
          )
        }
      }

      return sessionValue
    },
    write: <T,>(key: string, value: T): void => {
      try {
        const serialized = JSON.stringify(value)
        if (typeof serialized !== 'string') {
          return
        }

        const localStorageRef = getLocalStorage()
        persistSerializedValue(localStorageRef, key, serialized, 'localStorage')

        const sessionStorageRef = getSessionStorage()
        persistSerializedValue(sessionStorageRef, key, serialized, 'sessionStorage')
      } catch (error) {
        console.warn(`[useKV] Failed to serialize browser storage value for key "${key}"`, error)
      }
    },
    remove: (key: string): void => {
      const localStorageRef = getLocalStorage()
      removeValueFromStorage(localStorageRef, key, 'localStorage')

      const sessionStorageRef = getSessionStorage()
      removeValueFromStorage(sessionStorageRef, key, 'sessionStorage')
    },
    readMetadata: (key: string): StorageMetadata | undefined => {
      const localStorageRef = getLocalStorage()
      const metadata = readMetadataFromStorage(localStorageRef, key, 'localStorage')
      if (metadata) {
        return metadata
      }

      const sessionStorageRef = getSessionStorage()
      const sessionMetadata = readMetadataFromStorage(sessionStorageRef, key, 'sessionStorage')
      if (sessionMetadata && localStorageRef) {
        writeMetadataToStorage(localStorageRef, key, sessionMetadata, 'localStorage')
      }

      return sessionMetadata
    },
    writeMetadata: (key: string, metadata: StorageMetadata): void => {
      const localStorageRef = getLocalStorage()
      writeMetadataToStorage(localStorageRef, key, metadata, 'localStorage')

      const sessionStorageRef = getSessionStorage()
      writeMetadataToStorage(sessionStorageRef, key, metadata, 'sessionStorage')
    },
    removeMetadata: (key: string): void => {
      const localStorageRef = getLocalStorage()
      removeMetadataFromStorage(localStorageRef, key, 'localStorage')

      const sessionStorageRef = getSessionStorage()
      removeMetadataFromStorage(sessionStorageRef, key, 'sessionStorage')
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

