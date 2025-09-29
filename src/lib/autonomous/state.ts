import type { AgentName } from '@/lib/knowledge-utils'

export interface AutonomousState {
  isRunning: boolean
  currentAgent: AgentName
  currentCycle: number
  isAutonomous: boolean
}
