import type { AgentName } from '@/lib/knowledge-utils'

export function getNextAgent(
  current: AgentName,
  currentCycle: number
): { next: AgentName; newCycle: number } {
  if (current === 'Phys-Alpha') {
    return { next: 'Phys-Beta', newCycle: currentCycle }
  }

  if (current === 'Phys-Beta') {
    if (currentCycle % 2 === 0) {
      return { next: 'Phys-Gamma', newCycle: currentCycle }
    }
    return { next: 'Phys-Alpha', newCycle: currentCycle + 1 }
  }

  return { next: 'Phys-Alpha', newCycle: currentCycle + 1 }
}
