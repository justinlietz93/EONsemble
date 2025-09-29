import { useEffect, useRef } from 'react'

import type { AgentResponse, KnowledgeEntry, PhysicsGoal } from '@/App'
import { buildCollaborationContext, rankVectorMatches } from '@/lib/knowledge-utils'
import { registerVoidMemory } from '@/lib/api/void-manager'

const DEFAULT_REINFORCEMENT_GAIN = 0.6
const DEFAULT_TTL_BOOST = 60

const managerConfig = {
  capacity: 64,
  base_ttl: 120,
  decay_half_life: 8,
  prune_sample: 32,
  prune_target_ratio: 0.4,
  recency_half_life_ticks: 32,
  habituation_start: 16,
  habituation_scale: 1.0,
  boredom_weight: 0.35,
  frontier_novelty_threshold: 0.7,
  frontier_patience: 3,
  diffusion_interval: 12,
  diffusion_kappa: 0.25,
  exploration_churn_window: 32
}

const buildSignature = (goal: PhysicsGoal | undefined | null, responses: AgentResponse[], knowledge: KnowledgeEntry[]) => {
  if (!goal) return 'no-goal'
  const responseIds = responses.map(response => response.id).join('|')
  const knowledgeIds = knowledge.map(entry => entry.id).join('|')
  return `${goal.id}:${responseIds}:${knowledgeIds}`
}

export function useVoidMemoryBridge(
  goal: PhysicsGoal | undefined | null,
  responses: AgentResponse[],
  knowledge: KnowledgeEntry[]
): void {
  const lastSignature = useRef<string>('')

  useEffect(() => {
    if (!goal || responses.length === 0 || knowledge.length === 0) {
      return
    }

    const signature = buildSignature(goal, responses, knowledge)
    if (signature === lastSignature.current) {
      return
    }

    lastSignature.current = signature

    const context = buildCollaborationContext(goal, responses, knowledge)
    const matches = rankVectorMatches(context.documents, context.queryText, 5, 0.05)
    if (matches.length === 0) {
      return
    }

    const ids = matches.map(match => match.id)
    const texts = matches.map(match => match.content)
    const distances = matches.map(match => 1 - Math.min(1, Math.max(0, match.similarity)))

    void registerVoidMemory({
      config: managerConfig,
      ids,
      texts,
      reinforce: { ids: [ids], distances: [distances] },
      heat_gain: DEFAULT_REINFORCEMENT_GAIN,
      ttl_boost: DEFAULT_TTL_BOOST
    }).catch(() => {
      // Errors are logged in the API layer; we prevent repeated attempts by retaining signature
    })
  }, [goal, knowledge, responses])
}
