import { useState, useCallback, useEffect, useRef } from 'react'
import { AgentResponse, PhysicsGoal, KnowledgeEntry } from '@/App'
import type { KVUpdater } from '@/hooks/useKV'
import { AgentConfig, ProviderSettings } from '@/types/agent'
import { AutonomousConfig, AutonomousStopOptions } from '@/types/autonomous'
import { toast } from 'sonner'
import {
  AgentName,
  generateAgentResponse,
  getNextAgent,
  createAgentResponse,
  createKnowledgeEntry
} from '@/lib/autonomous'
import { AgentClientError } from '@/lib/api/agentClient'

export type { AgentName }

const AUTONOMOUS_LOOP_DELAY = 1000
const ACTIVE_WINDOW_RECHECK_DELAY = 30 * 60 * 1000
const ACTIVE_HOURS = { start: 7, end: 22 }

type AgentRunState = 'idle' | 'running' | 'success' | 'error'

interface AgentRunError {
  message: string
  hint?: string
}

const shouldDebugAgent = (): boolean => {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    return window.localStorage.getItem('eon.debugAgent') === 'true'
  } catch {
    return false
  }
}

const logAgentEvent = (event: string, detail?: Record<string, unknown>): void => {
  if (!shouldDebugAgent()) {
    return
  }

  if (detail) {
    console.info('[RUN]', event, detail)
  } else {
    console.info('[RUN]', event)
  }
}

const createRunError = (error: unknown): AgentRunError => {
  if (error instanceof AgentClientError) {
    const status = typeof error.status === 'number' ? error.status : null
    const hint = status
      ? status >= 500
        ? 'Check the remote Ollama runtime logs for server-side failures.'
        : 'Verify the Ollama endpoint URL, credentials, and model availability.'
      : 'Ensure the Ollama host is reachable from this browser and that CORS is enabled.'
    return {
      message: error.message,
      hint
    }
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      hint: 'Check the browser console and network inspector for additional details.'
    }
  }

  return {
    message: 'Unknown agent error',
    hint: 'Inspect the network panel and application logs for more information.'
  }
}

function isWithinActiveWindow(config: AutonomousConfig): boolean {
  if (config.continueOvernight) {
    return true
  }

  const hour = new Date().getHours()
  return hour >= ACTIVE_HOURS.start && hour < ACTIVE_HOURS.end
}

export interface AutonomousEngineProps {
  goal: PhysicsGoal
  derivationHistory: AgentResponse[]
  setDerivationHistory: (updater: KVUpdater<AgentResponse[]>) => void
  knowledgeBase: KnowledgeEntry[]
  setKnowledgeBase: (updater: KVUpdater<KnowledgeEntry[]>) => void
  agentConfigs: AgentConfig[]
  providerConfigs: ProviderSettings
  autonomousConfig: AutonomousConfig
  onStatusChange: (status: string) => void
  onStop: (options?: AutonomousStopOptions) => void
}

export function useAutonomousEngine({
  goal,
  derivationHistory,
  setDerivationHistory,
  knowledgeBase,
  setKnowledgeBase,
  agentConfigs,
  providerConfigs,
  autonomousConfig,
  onStatusChange,
  onStop
}: AutonomousEngineProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [runState, setRunState] = useState<AgentRunState>('idle')
  const [runError, setRunError] = useState<AgentRunError | null>(null)
  const [currentAgent, setCurrentAgent] = useState<AgentName>('Phys-Alpha')
  const [currentCycle, setCurrentCycle] = useState(1)
  const autonomousRef = useRef(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const configRef = useRef<AutonomousConfig>(autonomousConfig)

  const clearScheduledTurn = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    configRef.current = autonomousConfig
  }, [autonomousConfig])

  // Update ref when autonomous mode changes
  useEffect(() => {
    if (autonomousConfig.enabled) {
      autonomousRef.current = true
    } else {
      autonomousRef.current = false
      setIsRunning(false)
      setRunState('idle')
      setRunError(null)
      clearScheduledTurn()
    }
  }, [autonomousConfig.enabled, clearScheduledTurn])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearScheduledTurn()
    }
  }, [clearScheduledTurn])

  const processAgentTurn = useCallback(
    async (agentName: AgentName): Promise<void> => {
      if (isRunning) {
        logAgentEvent('skip-turn', { agent: agentName, reason: 'already-running' })
        return
      }

      setIsRunning(true)
      setRunState('running')
      setRunError(null)
      logAgentEvent('start-turn', { agent: agentName, cycle: currentCycle })
      onStatusChange(`${agentName} is working...`)

      let outcome: 'success' | 'error' = 'success'

      try {
        const agentConfig = agentConfigs.find(config => config.name === agentName && config.enabled)

        if (!agentConfig) {
          throw new Error(`Agent ${agentName} is not configured or disabled`)
        }

        const response = await generateAgentResponse(
          agentName,
          agentConfig,
          goal,
          derivationHistory,
          knowledgeBase,
          providerConfigs
        )

        const newResponse = createAgentResponse(agentName, response, currentCycle, goal.id)
        const knowledgeEntry = createKnowledgeEntry(
          agentName,
          response,
          currentCycle,
          goal.title,
          goal.domain
        )

        setDerivationHistory(prev => [...prev, newResponse])
        setKnowledgeBase(prev => [...prev, knowledgeEntry])

        onStatusChange(`${agentName} completed their turn`)
        setRunState('success')
      } catch (error) {
        outcome = 'error'
        const normalized = createRunError(error)
        setRunState('error')
        setRunError(normalized)
        onStatusChange(`Error: ${normalized.message}`)
        toast.error(`Agent error: ${normalized.message}`)
        logAgentEvent('turn-error', { agent: agentName, message: normalized.message, hint: normalized.hint })
        throw error
      } finally {
        setIsRunning(false)
        logAgentEvent('finish-turn', { agent: agentName, status: outcome, cycle: currentCycle })
      }
    },
    [
      agentConfigs,
      currentCycle,
      derivationHistory,
      goal,
      isRunning,
      knowledgeBase,
      onStatusChange,
      providerConfigs,
      setDerivationHistory,
      setKnowledgeBase
    ]
  )

  const runSingleTurn = useCallback(async (): Promise<void> => {
    if (isRunning) {
      logAgentEvent('single-run-skipped', { reason: 'already-running' })
      return
    }

    const config = configRef.current
    if (config.maxCycles > 0 && currentCycle > config.maxCycles) {
      const message = `Maximum cycles (${config.maxCycles}) reached.`
      onStatusChange(message)
      toast.warning(`${message} Autonomous mode stopped.`)

      if (autonomousRef.current) {
        autonomousRef.current = false
        clearScheduledTurn()
        onStop({ silent: true, reason: 'max-cycles' })
      }
      return
    }

    const executingAgent = currentAgent

    try {
      await processAgentTurn(executingAgent)

      const { next, newCycle } = getNextAgent(executingAgent, currentCycle)

      setCurrentAgent(next)
      setCurrentCycle(newCycle)

      if (config.stopOnGammaDecision && executingAgent === 'Phys-Gamma') {
        onStatusChange('Phys-Gamma completed oversight. Autonomous mode paused for review.')
        if (autonomousRef.current) {
          autonomousRef.current = false
          clearScheduledTurn()
          toast.info('Phys-Gamma paused autonomous mode for manual review.')
          onStop({ silent: true, reason: 'gamma-review' })
        }
      }
    } catch (error) {
      logAgentEvent('single-run-error', {
        agent: executingAgent,
        message: error instanceof Error ? error.message : 'unknown'
      })
      setIsRunning(false)
    }
  }, [
    isRunning,
    currentAgent,
    currentCycle,
    processAgentTurn,
    onStatusChange,
    onStop,
    clearScheduledTurn
  ])

  const runAutonomousLoop = useCallback(async (): Promise<void> => {
    if (!autonomousRef.current || isRunning) {
      logAgentEvent('autonomous-loop-skip', {
        active: autonomousRef.current,
        running: isRunning
      })
      return
    }

    const config = configRef.current

    if (!isWithinActiveWindow(config)) {
      onStatusChange('Autonomous mode paused outside active hours (07:00-22:00).')
      clearScheduledTurn()
      timeoutRef.current = setTimeout(() => {
        if (autonomousRef.current) {
          runAutonomousLoop()
        }
      }, ACTIVE_WINDOW_RECHECK_DELAY)
      return
    }

    try {
      await runSingleTurn()

      if (autonomousRef.current) {
        clearScheduledTurn()
        timeoutRef.current = setTimeout(() => {
          if (autonomousRef.current) {
            runAutonomousLoop()
          }
        }, AUTONOMOUS_LOOP_DELAY)
      }
    } catch (error) {
      logAgentEvent('autonomous-loop-error', {
        message: error instanceof Error ? error.message : 'unknown'
      })
      autonomousRef.current = false
      clearScheduledTurn()
      onStop({ silent: true, reason: 'error' })
    }
  }, [runSingleTurn, onStop, isRunning, onStatusChange, clearScheduledTurn])

  const runContinuousLoop = useCallback((): void => {
    autonomousRef.current = true
    onStatusChange('Starting continuous autonomous mode...')
    clearScheduledTurn()
    runAutonomousLoop()
  }, [onStatusChange, runAutonomousLoop, clearScheduledTurn])

  const reset = useCallback(() => {
    clearScheduledTurn()
    setCurrentAgent('Phys-Alpha')
    setCurrentCycle(1)
    setIsRunning(false)
    setRunState('idle')
    setRunError(null)
    autonomousRef.current = false
  }, [clearScheduledTurn])

  return {
    isRunning,
    currentAgent,
    currentCycle,
    runSingleTurn,
    runContinuousLoop,
    reset,
    runState,
    runError
  }
}