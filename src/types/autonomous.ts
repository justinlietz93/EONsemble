export type AutonomousStopReason = 'max-cycles' | 'gamma-review' | 'schedule' | 'error'

export interface AutonomousStopOptions {
  silent?: boolean
  reason?: AutonomousStopReason
}

export interface AutonomousConfig {
  enabled: boolean
  maxCycles: number
  stopOnGammaDecision: boolean
  continueOvernight: boolean
}

export const DEFAULT_AUTONOMOUS_CONFIG: AutonomousConfig = {
  enabled: false,
  maxCycles: 50,
  stopOnGammaDecision: true,
  continueOvernight: true
}
