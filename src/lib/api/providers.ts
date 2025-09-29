import { buildApiUrl } from './config'

interface OpenAIModelRecord {
  id?: string | null
  name?: string | null
}

interface OpenAIModelCatalogResponse {
  models?: OpenAIModelRecord[]
}

export interface FetchOpenAIModelOptions {
  forceRefresh?: boolean
}

export async function fetchOpenAIModelIds(options: FetchOpenAIModelOptions = {}): Promise<string[]> {
  const requestUrl = new URL(buildApiUrl('/api/openai/models'))

  if (options.forceRefresh) {
    requestUrl.searchParams.set('refresh', '1')
  }

  const response = await fetch(requestUrl.toString(), {
    headers: { 'Content-Type': 'application/json' }
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} when requesting OpenAI models`)
  }

  const payload = (await response.json()) as OpenAIModelCatalogResponse

  return (payload.models ?? [])
    .map(model => model.id || model.name || '')
    .map(value => value.trim())
    .filter((value): value is string => value.length > 0)
}
