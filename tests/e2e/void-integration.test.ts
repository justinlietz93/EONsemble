import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { AgentResponse, KnowledgeEntry, PhysicsGoal } from '@/App'
import { buildCollaborationContext, rankVectorMatches } from '@/lib/knowledge-utils'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..', '..')

interface PythonIntegrationResult {
  stats: { count: number; avg_confidence: number; avg_novelty: number; avg_boredom: number; avg_mass: number }
  events: { type: string; tick: number; [key: string]: unknown }[]
  top: [string, number][]
}

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

function runPythonManager(payload: unknown): PythonIntegrationResult {
  const pythonPath = process.env.PYTHONPATH ? `${repoRoot}${path.delimiter}${process.env.PYTHONPATH}` : repoRoot
  const script = `\nimport json\nimport sys\nfrom src.void_dynamics.manager import VoidMemoryManager\n\ndef build_manager(config):\n    return VoidMemoryManager(\n        capacity=config['capacity'],\n        base_ttl=config['base_ttl'],\n        decay_half_life=config['decay_half_life'],\n        prune_sample=config['prune_sample'],\n        prune_target_ratio=config['prune_target_ratio'],\n        recency_half_life_ticks=config['recency_half_life_ticks'],\n        habituation_start=config['habituation_start'],\n        habituation_scale=config['habituation_scale'],\n        boredom_weight=config['boredom_weight'],\n        frontier_novelty_threshold=config['frontier_novelty_threshold'],\n        frontier_patience=config['frontier_patience'],\n        diffusion_interval=config['diffusion_interval'],\n        diffusion_kappa=config['diffusion_kappa'],\n        exploration_churn_window=config['exploration_churn_window'],\n    )\n\ndef main():\n    payload = json.loads(sys.stdin.read())\n    manager = build_manager(payload['config'])\n    manager.register_chunks(ids=payload['ids'], raw_texts=payload['texts'])\n    manager.reinforce(\n        results=payload['reinforce'],\n        heat_gain=payload['heat_gain'],\n        ttl_boost=payload['ttl_boost'],\n    )\n    result = {\n        'stats': manager.stats(),\n        'events': manager.consume_events(),\n        'top': manager.top(3),\n    }\n    print(json.dumps(result))\n\nif __name__ == '__main__':\n    main()\n  `

  const output = execFileSync('python', ['-c', script], {
    cwd: repoRoot,
    env: { ...process.env, PYTHONPATH: pythonPath },
    encoding: 'utf8',
    input: JSON.stringify(payload)
  })

  return JSON.parse(output) as PythonIntegrationResult
}

describe('void dynamics cross-language integration', () => {
  it('registers and reinforces vector matches through the Python manager', () => {
    const goal: PhysicsGoal = {
      id: 'goal-void',
      title: 'Casimir cavity stress-energy unification',
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
      }
    ]

    const context = buildCollaborationContext(goal, responses, knowledgeBase)
    const vectorMatches = rankVectorMatches(context.documents, context.queryText, 3, 0.01)

    expect(vectorMatches.length).toBeGreaterThan(0)

    const ids = vectorMatches.map(match => match.id)
    const texts = vectorMatches.map(match => match.content)
    const reinforcement = {
      ids: [ids],
      distances: [vectorMatches.map(match => 1 - Math.min(1, Math.max(0, match.similarity)))]
    }

    const payload = {
      config: managerConfig,
      ids,
      texts,
      reinforce: reinforcement,
      heat_gain: 0.6,
      ttl_boost: 60
    }

    const result = runPythonManager(payload)

    expect(result.stats.count).toBe(ids.length)
    expect(result.stats.avg_confidence).toBeGreaterThan(0.3)
    expect(result.events.filter(event => event.type === 'register')).toHaveLength(ids.length)
    expect(result.events.some(event => event.type === 'reinforce')).toBe(true)
    expect(result.top[0][1]).toBeGreaterThan(0)
  })
})
