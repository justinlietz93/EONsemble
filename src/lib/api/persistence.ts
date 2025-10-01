import { buildApiUrl } from './config'

const buildUrl = (key: string) => buildApiUrl(`/api/state/${encodeURIComponent(key)}`)

export async function fetchPersistedValue<T>(key: string): Promise<T | undefined> {
  try {
    const response = await fetch(buildUrl(key), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })

    if (response.status === 404) {
      return undefined
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const payload = (await response.json()) as { value?: T }
    return payload.value
  } catch (error) {
    console.warn(`Failed to read persisted value for key "${key}"`, error)
    return undefined
  }
}

export async function savePersistedValue<T>(key: string, value: T): Promise<void> {
  try {
    const response = await fetch(buildUrl(key), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value })
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
  } catch (error) {
    console.warn(`Failed to persist value for key "${key}"`, error)
    throw error
  }
}

export async function removePersistedValue(key: string): Promise<void> {
  try {
    await fetch(buildUrl(key), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.warn(`Failed to remove persisted value for key "${key}"`, error)
  }
}
