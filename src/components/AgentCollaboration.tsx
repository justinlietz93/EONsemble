import { useState, useCallback, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowCounterClockwise, Brain } from '@phosphor-icons/react'
import { PhysicsGoal, AgentResponse, KnowledgeEntry } from '@/App'
import type { AutonomousConfig, AutonomousStopOptions } from '@/types/autonomous'
import { DEFAULT_AUTONOMOUS_CONFIG } from '@/types/autonomous'
import { AgentConfig, ProviderSettings, DEFAULT_PROVIDER_SETTINGS } from '@/types/agent'
import { useKV } from '@/hooks/useKV'
import { toast } from 'sonner'
import { useAutonomousEngine } from '@/components/AutonomousEngine'
import { AgentStatusPanel } from '@/components/AgentStatusPanel'
import { DerivationDisplay } from '@/components/DerivationDisplay'

interface AgentCollaborationProps {
  goal: PhysicsGoal | undefined
  derivationHistory: AgentResponse[]
  setDerivationHistory: (updater: (prev: AgentResponse[]) => AgentResponse[]) => void
  knowledgeBase: KnowledgeEntry[]
  setKnowledgeBase: (updater: (prev: KnowledgeEntry[]) => KnowledgeEntry[]) => void
}

export function AgentCollaboration({ 
  goal, 
  derivationHistory, 
  setDerivationHistory,
  knowledgeBase,
  setKnowledgeBase 
}: AgentCollaborationProps) {
  const [autonomousStatus, setAutonomousStatus] = useState<string>('')

  const [agentConfigs] = useKV<AgentConfig[]>('agent-configs', [])
  const [autonomousConfig, setAutonomousConfig] = useKV<AutonomousConfig>(
    'autonomous-config',
    DEFAULT_AUTONOMOUS_CONFIG
  )
  const [providerConfigs] = useKV<ProviderSettings>('provider-configs', DEFAULT_PROVIDER_SETTINGS)

  const isAutonomous = Boolean(autonomousConfig?.enabled)
  const lastStopReasonRef = useRef<AutonomousStopOptions['reason']>()

  const handleStatusChange = useCallback((status: string) => {
    setAutonomousStatus(status)
  }, [])

  const handleStop = useCallback(
    (options?: AutonomousStopOptions) => {
      lastStopReasonRef.current = options?.reason
      setAutonomousConfig(prev => ({
        ...(prev ?? DEFAULT_AUTONOMOUS_CONFIG),
        enabled: false
      }))

      if (!options?.silent && (autonomousConfig?.enabled ?? false)) {
        toast.success('Autonomous mode stopped')
      }
    },
    [autonomousConfig?.enabled, setAutonomousConfig]
  )

  const {
    isRunning,
    currentAgent,
    currentCycle,
    runSingleTurn,
    runContinuousLoop,
    reset: resetAutonomousEngine
  } = useAutonomousEngine({
    goal: goal!,
    derivationHistory,
    setDerivationHistory,
    knowledgeBase,
    setKnowledgeBase,
    agentConfigs: agentConfigs || [],
    providerConfigs: providerConfigs || DEFAULT_PROVIDER_SETTINGS,
    autonomousConfig: autonomousConfig || DEFAULT_AUTONOMOUS_CONFIG,
    onStatusChange: handleStatusChange,
    onStop: handleStop
  })

  const previousAutonomousEnabledRef = useRef(isAutonomous)

  useEffect(() => {
    if (isAutonomous && !previousAutonomousEnabledRef.current) {
      if (!goal) {
        toast.error('Select a research goal before starting autonomous mode.')
        setAutonomousConfig(prev => ({
          ...(prev ?? DEFAULT_AUTONOMOUS_CONFIG),
          enabled: false
        }))
        previousAutonomousEnabledRef.current = false
        return
      }

      const enabledAgents = (agentConfigs || []).filter(config => config.enabled)
      if (enabledAgents.length === 0) {
        toast.error('Enable at least one agent before starting autonomous mode.')
        setAutonomousConfig(prev => ({
          ...(prev ?? DEFAULT_AUTONOMOUS_CONFIG),
          enabled: false
        }))
        previousAutonomousEnabledRef.current = false
        return
      }

      lastStopReasonRef.current = undefined
      setAutonomousStatus('Autonomous mode activated')
      toast.success('Autonomous mode started')
      runContinuousLoop()
    } else if (!isAutonomous && previousAutonomousEnabledRef.current) {
      resetAutonomousEngine()
      if (!lastStopReasonRef.current) {
        setAutonomousStatus('')
      }
      lastStopReasonRef.current = undefined
    }

    previousAutonomousEnabledRef.current = isAutonomous
  }, [
    agentConfigs,
    goal,
    isAutonomous,
    resetAutonomousEngine,
    runContinuousLoop,
    setAutonomousConfig,
    setAutonomousStatus
  ])

  if (!goal) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No Active Goal</h3>
          <p className="text-muted-foreground">
            Please select a research goal to start agent collaboration
          </p>
        </CardContent>
      </Card>
    )
  }

  const goalHistory = derivationHistory.filter(response => response.goalId === goal.id)

  const handleStartAutonomous = () => {
    console.log('Starting autonomous mode...')
    console.log('Agent configs:', agentConfigs)
    console.log('Goal:', goal)

    if (!agentConfigs || agentConfigs.length === 0) {
      toast.error('No agent configurations found. Please check Agent Settings.')
      return
    }

    if (!goal) {
      toast.error('No active goal selected.')
      return
    }

    setAutonomousStatus('Starting autonomous mode...')
    setAutonomousConfig(prev => ({
      ...(prev ?? DEFAULT_AUTONOMOUS_CONFIG),
      enabled: true
    }))
  }

  const handleStopAutonomous = () => {
    handleStop()
  }

  const handleReset = () => {
    resetAutonomousEngine()
    handleStop()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Agent Collaboration</h2>
          <p className="text-muted-foreground">
            Working on: {goal.title}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset} disabled={isRunning}>
            <ArrowCounterClockwise className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <AgentStatusPanel
          currentAgent={currentAgent}
          currentCycle={currentCycle}
          isRunning={isRunning}
          isAutonomous={isAutonomous}
          autonomousStatus={autonomousStatus}
          onRunSingleTurn={runSingleTurn}
          onStartAutonomous={handleStartAutonomous}
          onStopAutonomous={handleStopAutonomous}
        />

        <DerivationDisplay 
          goalHistory={goalHistory}
          goalTitle={goal.title}
        />
      </div>
    </div>
  )
}