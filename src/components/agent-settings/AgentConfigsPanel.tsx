import { Robot } from '@phosphor-icons/react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { FetchOpenAIModelOptions } from '@/lib/api/providers'
import type { AgentConfig } from '@/types/agent'

interface AgentConfigsPanelProps {
  agents: AgentConfig[]
  onAgentChange: <Field extends keyof AgentConfig>(
    agentId: string,
    field: Field,
    value: AgentConfig[Field]
  ) => void
  getModelOptions: (agent: AgentConfig) => string[]
  enrichModelOptions: (options: string[], currentModel: string) => string[]
  openAIState: {
    loading: boolean
    error: string | null
    modelCount: number
    onRefresh: (options?: FetchOpenAIModelOptions) => Promise<void>
  }
  ollamaState: {
    loading: boolean
    error: string | null
    baseUrl: string
    onRefresh: () => Promise<void>
  }
  openRouterState: {
    loading: boolean
    error: string | null
    modelCount: number
    onRefresh: () => Promise<void>
  }
}

export function AgentConfigsPanel({
  agents,
  onAgentChange,
  getModelOptions,
  enrichModelOptions,
  openAIState,
  ollamaState,
  openRouterState
}: AgentConfigsPanelProps) {
  return (
    <div className="space-y-6">
      {agents.map(agent => {
        const modelOptions = enrichModelOptions(getModelOptions(agent), agent.model)
        const isOpenAI = agent.provider === 'openai'
        const isOllama = agent.provider === 'ollama'
        const isOpenRouter = agent.provider === 'openrouter'

        return (
          <Card key={agent.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Robot className="h-5 w-5" />
                  {agent.name}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={agent.enabled ? 'default' : 'secondary'}>
                    {agent.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                  <Switch
                    checked={agent.enabled}
                    onCheckedChange={checked => onAgentChange(agent.id, 'enabled', checked)}
                  />
                </div>
              </CardTitle>
              <p className="text-sm text-muted-foreground">{agent.role}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`provider-${agent.id}`}>Provider</Label>
                  <Select
                    value={agent.provider}
                    onValueChange={value => onAgentChange(agent.id, 'provider', value as AgentConfig['provider'])}
                  >
                    <SelectTrigger id={`provider-${agent.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="spark">Spark (GitHub)</SelectItem>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="openrouter">OpenRouter</SelectItem>
                      <SelectItem value="ollama">Ollama (Local)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`model-${agent.id}`}>Model</Label>
                  <Select
                    value={agent.model}
                    onValueChange={value => onAgentChange(agent.id, 'model', value)}
                    disabled={modelOptions.length === 0}
                  >
                    <SelectTrigger id={`model-${agent.id}`}>
                      <SelectValue placeholder="Select or enter a model" />
                    </SelectTrigger>
                    <SelectContent>
                      {modelOptions.length === 0 ? (
                        <SelectItem value="" disabled>
                          {isOllama
                            ? 'No Ollama models detected'
                            : isOpenRouter
                              ? 'No OpenRouter models available'
                              : 'No models configured'}
                        </SelectItem>
                      ) : (
                        modelOptions.map(model => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <Input
                    id={`model-input-${agent.id}`}
                    value={agent.model}
                    onChange={event => onAgentChange(agent.id, 'model', event.target.value)}
                    placeholder="Enter a custom model identifier"
                  />
                  <p className="text-xs text-muted-foreground">
                    Choose from the list or type any model supported by the selected provider.
                  </p>
                  {isOpenAI && (
                    <div className="flex items-center justify-between text-xs">
                      <span className={openAIState.error ? 'text-destructive' : 'text-muted-foreground'}>
                        {openAIState.loading
                          ? 'Loading OpenAI catalog...'
                          : openAIState.error ||
                            (openAIState.modelCount > 0
                              ? `Loaded ${openAIState.modelCount} models`
                              : 'Using bundled OpenAI catalog')}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void openAIState.onRefresh({ forceRefresh: true })}
                        disabled={openAIState.loading}
                      >
                        Refresh
                      </Button>
                    </div>
                  )}
                  {isOllama && (
                    <div className="flex items-center justify-between text-xs">
                      <span className={ollamaState.error ? 'text-destructive' : 'text-muted-foreground'}>
                        {ollamaState.loading
                          ? 'Loading models from Ollama...'
                          : ollamaState.error
                            ? ollamaState.error
                            : `Models loaded from ${ollamaState.baseUrl}`}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void ollamaState.onRefresh()}
                        disabled={ollamaState.loading}
                      >
                        Refresh
                      </Button>
                    </div>
                  )}
                  {isOpenRouter && (
                    <div className="flex items-center justify-between text-xs">
                      <span className={openRouterState.error ? 'text-destructive' : 'text-muted-foreground'}>
                        {openRouterState.loading
                          ? 'Loading models from OpenRouter...'
                          : openRouterState.error
                            ? openRouterState.error
                            : openRouterState.modelCount > 0
                              ? `Loaded ${openRouterState.modelCount} models`
                              : 'Using static OpenRouter suggestions'}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void openRouterState.onRefresh()}
                        disabled={openRouterState.loading}
                      >
                        Refresh
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`temperature-${agent.id}`}>
                    Temperature: {agent.temperature}
                  </Label>
                  <Input
                    id={`temperature-${agent.id}`}
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={agent.temperature}
                    onChange={event =>
                      onAgentChange(agent.id, 'temperature', parseFloat(event.target.value))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`tokens-${agent.id}`}>Max Tokens</Label>
                  <Input
                    id={`tokens-${agent.id}`}
                    type="number"
                    value={agent.maxTokens}
                    onChange={event =>
                      onAgentChange(agent.id, 'maxTokens', parseInt(event.target.value, 10))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`prompt-${agent.id}`}>System Prompt</Label>
                <Textarea
                  id={`prompt-${agent.id}`}
                  value={agent.systemPrompt}
                  onChange={event => onAgentChange(agent.id, 'systemPrompt', event.target.value)}
                  rows={4}
                  className="font-mono text-sm"
                />
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
