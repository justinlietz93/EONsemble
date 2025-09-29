import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { FetchOpenAIModelOptions } from '@/lib/api/providers'
import type { ProviderSettings } from '@/types/agent'

interface ProviderSettingsPanelProps {
  providerConfigs: ProviderSettings
  defaultReferer: string
  onProviderChange: <P extends keyof ProviderSettings>(
    provider: P,
    field: keyof ProviderSettings[P],
    value: ProviderSettings[P][keyof ProviderSettings[P]]
  ) => void
  fetchOpenAIModels: (options?: FetchOpenAIModelOptions) => Promise<void>
  openAIState: {
    loading: boolean
    error: string | null
    modelCount: number
  }
  fetchOpenRouterModels: () => Promise<void>
  openRouterState: {
    loading: boolean
    error: string | null
    modelCount: number
  }
  fetchOllamaModels: () => Promise<void>
  ollamaState: {
    loading: boolean
    error: string | null
    baseUrl: string
    modelCount: number
  }
}

export function ProviderSettingsPanel({
  providerConfigs,
  defaultReferer,
  onProviderChange,
  fetchOpenAIModels,
  openAIState,
  fetchOpenRouterModels,
  openRouterState,
  fetchOllamaModels,
  ollamaState
}: ProviderSettingsPanelProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>OpenAI</CardTitle>
          <p className="text-sm text-muted-foreground">
            Configure access to the OpenAI Chat Completions API.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="openai-api-key">API Key</Label>
              <Input
                id="openai-api-key"
                type="password"
                value={providerConfigs?.openai?.apiKey || ''}
                onChange={event => onProviderChange('openai', 'apiKey', event.target.value)}
                placeholder="sk-..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="openai-base-url">Base URL</Label>
              <Input
                id="openai-base-url"
                value={providerConfigs?.openai?.baseUrl || ''}
                onChange={event => onProviderChange('openai', 'baseUrl', event.target.value)}
                placeholder="https://api.openai.com/v1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="openai-org">Organization (optional)</Label>
              <Input
                id="openai-org"
                value={providerConfigs?.openai?.organization || ''}
                onChange={event => onProviderChange('openai', 'organization', event.target.value)}
                placeholder="org-..."
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchOpenAIModels({ forceRefresh: true })}
              disabled={openAIState.loading}
            >
              Refresh model catalog
            </Button>
            <span className={`text-xs ${openAIState.error ? 'text-destructive' : 'text-muted-foreground'}`}>
              {openAIState.loading
                ? 'Loading OpenAI model list...'
                : openAIState.error ||
                  (openAIState.modelCount > 0
                    ? `Cached ${openAIState.modelCount} models`
                    : 'Bundled defaults will be used until the catalog loads.')}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            The API key is stored locally using Spark KV storage. Leave the base URL empty to use the default OpenAI endpoint.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>OpenRouter</CardTitle>
          <p className="text-sm text-muted-foreground">
            Connect to OpenRouter and synchronize available models for your agents.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="openrouter-api-key">API Key</Label>
              <Input
                id="openrouter-api-key"
                type="password"
                value={providerConfigs?.openrouter?.apiKey || ''}
                onChange={event => onProviderChange('openrouter', 'apiKey', event.target.value)}
                placeholder="or-..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="openrouter-base-url">Base URL</Label>
              <Input
                id="openrouter-base-url"
                value={providerConfigs?.openrouter?.baseUrl || ''}
                onChange={event => onProviderChange('openrouter', 'baseUrl', event.target.value)}
                placeholder="https://openrouter.ai/api/v1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="openrouter-referer">HTTP Referer</Label>
              <Input
                id="openrouter-referer"
                value={providerConfigs?.openrouter?.referer || ''}
                onChange={event => onProviderChange('openrouter', 'referer', event.target.value)}
                placeholder={defaultReferer}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="openrouter-app">Application Name</Label>
              <Input
                id="openrouter-app"
                value={providerConfigs?.openrouter?.appName || ''}
                onChange={event => onProviderChange('openrouter', 'appName', event.target.value)}
                placeholder="Collaborative Physicist"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchOpenRouterModels()}
              disabled={openRouterState.loading}
            >
              Refresh model catalog
            </Button>
            <span className={`text-xs ${openRouterState.error ? 'text-destructive' : 'text-muted-foreground'}`}>
              {openRouterState.loading
                ? 'Requesting latest model catalog...'
                : openRouterState.error
                  ? openRouterState.error
                  : openRouterState.modelCount > 0
                    ? `Cached ${openRouterState.modelCount} models`
                    : 'Model suggestions will use bundled defaults until a catalog is fetched.'}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ollama</CardTitle>
          <p className="text-sm text-muted-foreground">
            Connect to a local Ollama runtime and expose the downloaded models to your agents.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ollama-base-url">Base URL</Label>
              <Input
                id="ollama-base-url"
                value={providerConfigs?.ollama?.baseUrl || ''}
                onChange={event => onProviderChange('ollama', 'baseUrl', event.target.value)}
                placeholder="http://localhost:11434"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchOllamaModels()}
              disabled={ollamaState.loading}
            >
              Refresh installed models
            </Button>
            <span className={`text-xs ${ollamaState.error ? 'text-destructive' : 'text-muted-foreground'}`}>
              {ollamaState.loading
                ? 'Contacting Ollama host...'
                : ollamaState.error
                  ? ollamaState.error
                  : ollamaState.modelCount > 0
                    ? `Detected ${ollamaState.modelCount} models`
                    : `Watching ${ollamaState.baseUrl} for models.`}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Ollama requests are issued directly from your browser. Ensure the host is accessible and CORS is enabled if connecting remotely.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
