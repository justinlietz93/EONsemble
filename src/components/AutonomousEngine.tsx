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

export type { AgentName }

const AUTONOMOUS_LOOP_DELAY = 1000
const ACTIVE_WINDOW_RECHECK_DELAY = 30 * 60 * 1000
const ACTIVE_HOURS = { start: 7, end: 22 }

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
      clearScheduledTurn()
    }
  }, [autonomousConfig.enabled, clearScheduledTurn])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearScheduledTurn()
    }
  }, [clearScheduledTurn])

  const processAgentTurn = useCallback(async (agentName: AgentName): Promise<void> => {
    if (isRunning) {
      console.log('processAgentTurn called but already running, skipping...')
      return
    }
    
    console.log('Setting isRunning to true for agent:', agentName)
    setIsRunning(true)
    onStatusChange(`${agentName} is working...`)
    
    try {
      console.log('Finding agent config for:', agentName)
      const agentConfig = agentConfigs.find(config => 
        config.name === agentName && config.enabled
      )
      
      if (!agentConfig) {
        throw new Error(`Agent ${agentName} is not configured or disabled`)
      }

      console.log('Generating response for agent:', agentName)
      const response = await generateAgentResponse(
        agentName,
        agentConfig,
        goal,
        derivationHistory,
        knowledgeBase,
        providerConfigs
      )
      
      console.log('Response generated, creating response objects')
      const newResponse = createAgentResponse(agentName, response, currentCycle, goal.id)
      const knowledgeEntry = createKnowledgeEntry(
        agentName,
        response,
        currentCycle,
        goal.title,
        goal.domain
      )
      
      console.log('Adding response to derivation history')
      setDerivationHistory(prev => [...prev, newResponse])
      
      console.log('Adding knowledge entry')
      setKnowledgeBase(prev => [...prev, knowledgeEntry])
      
      onStatusChange(`${agentName} completed their turn`)
      console.log('Agent turn completed successfully')
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Error in processAgentTurn:', error)
      onStatusChange(`Error: ${errorMessage}`)
      toast.error(`Agent error: ${errorMessage}`)
      throw error
    } finally {
      console.log('Setting isRunning to false')
      setIsRunning(false)
    }
  }, [currentCycle, goal, agentConfigs, derivationHistory, knowledgeBase, providerConfigs, setDerivationHistory, setKnowledgeBase, onStatusChange, isRunning])

  const runSingleTurn = useCallback(async (): Promise<void> => {
    console.log('runSingleTurn called, isRunning:', isRunning)

    if (isRunning) {
      console.log('Already running, returning')
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
      console.log('Processing agent turn for:', executingAgent)
      await processAgentTurn(executingAgent)

      console.log('Agent turn completed, getting next agent')
      const { next, newCycle } = getNextAgent(executingAgent, currentCycle)

      setCurrentAgent(next)
      setCurrentCycle(newCycle)
      console.log('Next agent:', next, 'Next cycle:', newCycle)

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
      console.error('Agent turn failed:', error)
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
    console.log('runAutonomousLoop called, autonomousRef.current:', autonomousRef.current, 'isRunning:', isRunning)

    if (!autonomousRef.current || isRunning) {
      console.log('Conditions not met, returning')
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
      console.log('Running single turn...')
      await runSingleTurn()

      // Continue automatically if still in autonomous mode
      if (autonomousRef.current) {
        console.log('Scheduling next turn...')
        clearScheduledTurn()
        timeoutRef.current = setTimeout(() => {
          if (autonomousRef.current) {
            runAutonomousLoop()
          }
        }, AUTONOMOUS_LOOP_DELAY)
      }
    } catch (error) {
      console.error('Autonomous loop error:', error)
      autonomousRef.current = false
      clearScheduledTurn()
      onStop({ silent: true, reason: 'error' })
    }
  }, [runSingleTurn, onStop, isRunning, onStatusChange, clearScheduledTurn])

  const runContinuousLoop = useCallback((): void => {
    console.log('runContinuousLoop called, current autonomous ref:', autonomousRef.current)

    autonomousRef.current = true
    onStatusChange('Starting continuous autonomous mode...')

    // Start the autonomous loop immediately
    console.log('Starting autonomous loop')
    clearScheduledTurn()
    runAutonomousLoop()
  }, [onStatusChange, runAutonomousLoop, clearScheduledTurn])

  const reset = useCallback(() => {
    clearScheduledTurn()
    setCurrentAgent('Phys-Alpha')
    setCurrentCycle(1)
    setIsRunning(false)
    autonomousRef.current = false
  }, [clearScheduledTurn])

  return {
    isRunning,
    currentAgent,
    currentCycle,
    runSingleTurn,
    runContinuousLoop,
    reset
  }
}