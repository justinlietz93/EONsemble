import { describe, expect, it } from 'vitest'

import type { AgentResponse, KnowledgeEntry, PhysicsGoal } from '@/App'
import {
  buildCollaborationContext,
  buildConceptTags,
  deriveGraphInsights,
  formatAgentKnowledgeContext,
  rankVectorMatches
} from '@/lib/knowledge-utils'

describe('knowledge retrieval pipeline', () => {
  const goal: PhysicsGoal = {
    id: 'goal-void',
    title: 'Unify vacuum energy with boundary stress tensor',
    description: 'Construct a renormalised energy-momentum derivation for a Casimir cavity.',
    domain: 'quantum field theory',
    objectives: ['Quantify energy density', 'Connect to experimental observables'],
    constraints: ['Maintain Lorentz invariance', 'Respect gauge symmetry'],
    createdAt: '2025-01-01T00:00:00Z'
  }

  const knowledgeBase: KnowledgeEntry[] = [
    {
      id: 'knowledge-casimir',
      title: 'Casimir cavity energy tensor synthesis',
      content: 'Energy density and stress tensor relations for vacuum fluctuations between conducting plates.',
      source: 'void-dynamics-lab',
      tags: ['qft', 'vacuum'],
      timestamp: '2025-01-03T00:00:00Z'
    },
    {
      id: 'knowledge-noether',
      title: 'Noether symmetries for boundary constrained actions',
      content: 'Derivation emphasises momentum flux conservation and gauge invariant boundary terms.',
      source: 'void-dynamics-lab',
      tags: ['symmetry'],
      timestamp: '2025-01-02T00:00:00Z'
    }
  ]

  const responses: AgentResponse[] = [
    {
      id: 'resp-1',
      agent: 'Phys-Alpha',
      content: 'Cycle 1 emphasised energy flux balance and tensor symmetries in the cavity walls.',
      timestamp: '2025-02-01T10:00:00Z',
      cycle: 1,
      goalId: 'goal-void'
    },
    {
      id: 'resp-2',
      agent: 'Phys-Beta',
      content: 'We confirmed momentum conservation and coupled the stress tensor to boundary mode sums.',
      timestamp: '2025-02-01T11:00:00Z',
      cycle: 2,
      goalId: 'goal-void'
    },
    {
      id: 'resp-3',
      agent: 'Phys-Gamma',
      content: 'Open question: Should we include radiative corrections from residual electromagnetic modes?',
      timestamp: '2025-02-01T12:00:00Z',
      cycle: 3,
      goalId: 'goal-void'
    },
    {
      id: 'resp-4',
      agent: 'Phys-Alpha',
      content: 'Refined tensor density emphasises vacuum energy cancellation and gauge symmetry compliance.',
      timestamp: '2025-02-01T13:00:00Z',
      cycle: 4,
      goalId: 'goal-void'
    },
    {
      id: 'resp-5',
      agent: 'Phys-Beta',
      content: 'Boundary momentum inflow couples to the energy density we derived earlier.',
      timestamp: '2025-02-01T14:00:00Z',
      cycle: 5,
      goalId: 'goal-void'
    }
  ]

  it('surfaces semantically deep context blending knowledge and collaboration traces', () => {
    const context = buildCollaborationContext(goal, responses, knowledgeBase)

    expect(context.recentExchanges).toHaveLength(4)
    expect(context.recentExchanges[0].cycle).toBe(2)
    expect(context.recentExchanges[3].cycle).toBe(5)

    const vectorMatches = rankVectorMatches(context.documents, context.queryText, 6, 0.02)
    expect(vectorMatches.length).toBeGreaterThan(0)
    const topMatch = vectorMatches[0]
    expect(topMatch.similarity).toBeGreaterThan(0.1)

    const graphInsights = deriveGraphInsights(vectorMatches.slice(0, 2), context.documents)
    expect(graphInsights.length).toBeGreaterThan(0)
    expect(graphInsights[0].related.length).toBeGreaterThan(0)
    expect(graphInsights[0].related[0].sharedTags.length).toBeGreaterThan(0)

    const knowledgeContext = formatAgentKnowledgeContext(context, vectorMatches, graphInsights)

    expect(knowledgeContext.collaborationDigest).toContain('Cycle 2 – Phys-Beta')
    expect(knowledgeContext.vectorHighlights[0]).toMatch(/similarity/) 
    expect(knowledgeContext.knowledgeGraphInsights[0]).toMatch(/shared:/)
    expect(knowledgeContext.collaborationFocus[0]).toMatch(/Open question/)
  })

  it('augments existing tags with detected physics concepts', () => {
    const tags = buildConceptTags('Momentum and energy transfer in the stress tensor analysis.', ['custom'])
    expect(tags).toContain('custom')
    expect(tags).toContain('energy')
    expect(tags).toContain('momentum')
  })
})

describe('knowledge context fallback behaviour', () => {
  it('provides default messaging when no history exists', () => {
    const goal: PhysicsGoal = {
      id: 'goal-empty',
      title: 'Baseline check',
      description: 'Verify fallback messaging for empty memories.',
      domain: 'test',
      objectives: [],
      constraints: [],
      createdAt: '2025-01-01T00:00:00Z'
    }

    const context = buildCollaborationContext(goal, [], [])
    const knowledgeContext = formatAgentKnowledgeContext(context, [], [])

    expect(knowledgeContext.collaborationDigest).toMatch(/No prior collaboration/)
    expect(knowledgeContext.vectorHighlights).toHaveLength(0)
    expect(knowledgeContext.knowledgeGraphInsights).toHaveLength(0)
    expect(knowledgeContext.collaborationFocus).toHaveLength(0)
  })
})
