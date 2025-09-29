import { buildApiUrl } from './config'

export interface VoidRegistrationPayload {
  config?: Record<string, unknown>
  ids: string[]
  texts: string[]
  reinforce?: {
    ids: string[][]
    distances?: number[][]
  }
  heat_gain?: number
  ttl_boost?: number
}

export interface VoidRegistrationResponse {
  stats: { count: number; avg_confidence: number; avg_novelty: number; avg_boredom: number; avg_mass: number }
  events: { type: string; tick: number; [key: string]: unknown }[]
  top: [string, number][]
}

export async function registerVoidMemory(payload: VoidRegistrationPayload): Promise<VoidRegistrationResponse> {
  try {
    const response = await fetch(buildApiUrl('/api/void/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    return (await response.json()) as VoidRegistrationResponse
  } catch (error) {
    console.warn('Failed to update VoidMemoryManager', error)
    throw error
  }
}
