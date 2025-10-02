import { useCallback } from 'react'
import { Gear, Robot, Lightning } from '@phosphor-icons/react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useKV } from '@/hooks/useKV'
import type { AgentConfig } from '@/types/agent'
import type { AutonomousConfig } from '@/types/autonomous'
import { DEFAULT_AUTONOMOUS_CONFIG } from '@/types/autonomous'

import { AgentConfigsPanel } from './agent-settings/AgentConfigsPanel'
import { AutonomousSettingsPanel } from './agent-settings/AutonomousSettingsPanel'
import { ProviderSettingsPanel } from './agent-settings/ProviderSettingsPanel'
import { useAgentSettingsState } from './agent-settings/useAgentSettingsState'

const SETTINGS_TABS = ['agents', 'providers', 'autonomous'] as const
type SettingsTab = (typeof SETTINGS_TABS)[number]

const isSettingsTab = (value: string): value is SettingsTab =>
  SETTINGS_TABS.includes(value as SettingsTab)

interface AgentSettingsProps {
  onConfigChange?: (configs: AgentConfig[]) => void
  onAutonomousChange?: (config: AutonomousConfig) => void
}

export function AgentSettings({ onConfigChange, onAutonomousChange }: AgentSettingsProps) {
  const [activeSettingsTab, setActiveSettingsTab] = useKV<SettingsTab>(
    'agent-settings.activeTab',
    'agents'
  )

  const {
    agentConfigs,
    providerConfigs,
    autonomousConfig,
    defaultReferer,
    openAIModels,
    openAILoading,
    openAIError,
    ollamaModels,
    ollamaLoading,
    ollamaError,
    openRouterModels,
    openRouterLoading,
    openRouterError,
    ollamaBaseUrl,
    qdrantBaseUrl,
    qdrantStatus,
    qdrantLoading,
    qdrantMessage,
    probeQdrant,
    handleAgentConfigChange,
    handleProviderConfigChange,
    handleAutonomousConfigChange,
    fetchOpenAIModels,
    fetchOllamaModels,
    fetchOpenRouterModels,
    resetToDefaults,
    getModelOptions,
    enrichModelOptions
  } = useAgentSettingsState({ onConfigChange, onAutonomousChange })

  const handleAutonomousInfo = useCallback(() => {
    toast.info('Autonomous mode can be started from the Collaboration tab')
  }, [])

  const handleSettingsTabChange = useCallback(
    (nextTab: string) => {
      if (isSettingsTab(nextTab)) {
        setActiveSettingsTab(nextTab)
      }
    },
    [setActiveSettingsTab]
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Gear className="h-6 w-6" />
            Agent Settings
          </h2>
          <p className="text-muted-foreground">
            Configure agent behavior, models, providers, and autonomous operation
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetToDefaults}>
            Reset to Defaults
          </Button>
        </div>
      </div>

      <Tabs value={activeSettingsTab} onValueChange={handleSettingsTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="agents" className="flex items-center gap-2">
            <Robot className="h-4 w-4" />
            Agent Configuration
          </TabsTrigger>
          <TabsTrigger value="providers" className="flex items-center gap-2">
            <Gear className="h-4 w-4" />
            Provider Credentials
          </TabsTrigger>
          <TabsTrigger value="autonomous" className="flex items-center gap-2">
            <Lightning className="h-4 w-4" />
            Autonomous Mode
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agents">
          <AgentConfigsPanel
            agents={agentConfigs}
            onAgentChange={handleAgentConfigChange}
            getModelOptions={getModelOptions}
            enrichModelOptions={enrichModelOptions}
            openAIState={{
              loading: openAILoading,
              error: openAIError,
              modelCount: openAIModels.length,
              onRefresh: fetchOpenAIModels
            }}
            ollamaState={{
              loading: ollamaLoading,
              error: ollamaError,
              baseUrl: ollamaBaseUrl,
              onRefresh: fetchOllamaModels
            }}
            openRouterState={{
              loading: openRouterLoading,
              error: openRouterError,
              modelCount: openRouterModels.length,
              onRefresh: fetchOpenRouterModels
            }}
          />
        </TabsContent>

        <TabsContent value="providers">
          <ProviderSettingsPanel
            providerConfigs={providerConfigs}
            defaultReferer={defaultReferer}
            onProviderChange={handleProviderConfigChange}
            fetchOpenAIModels={fetchOpenAIModels}
            openAIState={{
              loading: openAILoading,
              error: openAIError,
              modelCount: openAIModels.length
            }}
            fetchOpenRouterModels={fetchOpenRouterModels}
            openRouterState={{
              loading: openRouterLoading,
              error: openRouterError,
              modelCount: openRouterModels.length
            }}
            fetchOllamaModels={fetchOllamaModels}
            ollamaState={{
              loading: ollamaLoading,
              error: ollamaError,
              baseUrl: ollamaBaseUrl,
              modelCount: ollamaModels.length
            }}
            qdrantState={{
              baseUrl: qdrantBaseUrl,
              status: qdrantStatus,
              loading: qdrantLoading,
              message: qdrantMessage,
              onProbe: probeQdrant
            }}
          />
        </TabsContent>

        <TabsContent value="autonomous">
          <AutonomousSettingsPanel
            config={autonomousConfig}
            defaultConfig={DEFAULT_AUTONOMOUS_CONFIG}
            onChange={handleAutonomousConfigChange}
            onInfoRequest={handleAutonomousInfo}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
