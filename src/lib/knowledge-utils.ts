import { AgentResponse, KnowledgeEntry, PhysicsGoal } from '@/App'

export type AgentName = 'Phys-Alpha' | 'Phys-Beta' | 'Phys-Gamma'

export const PHYSICS_CONCEPT_TERMS = [
  'energy', 'momentum', 'force', 'velocity', 'acceleration', 'mass', 'charge',
  'field', 'wave', 'particle', 'quantum', 'classical', 'relativistic',
  'electromagnetic', 'gravitational', 'thermodynamic', 'entropy',
  'hamiltonian', 'lagrangian', 'operator', 'eigenvalue', 'wavefunction',
  'schr\u00f6dinger', 'schrodinger', 'maxwell', 'newton', 'einstein', 'equation', 'law',
  'conservation', 'symmetry', 'invariance', 'transformation', 'spacetime',
  'metric', 'tensor', 'differential', 'integral', 'vector', 'scalar',
  'potential', 'kinetic', 'angular', 'torque', 'flux', 'gauss', 'ampere',
  'lorentz', 'planck', 'uncertainty', 'commutator', 'green', 'lagrange',
  'path', 'action', 'phase', 'boundary', 'eigenstate', 'expectation'
] as const

export type PhysicsConcept = typeof PHYSICS_CONCEPT_TERMS[number]

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'from', 'into', 'about', 'which',
  'their', 'have', 'will', 'while', 'there', 'where', 'when', 'been', 'being',
  'such', 'within', 'between', 'over', 'under', 'through', 'these', 'those',
  'each', 'other', 'more', 'less', 'very', 'also', 'than', 'then', 'because',
  'after', 'before', 'using', 'used', 'upon', 'could', 'would', 'should'
])

const FOCUS_PATTERNS = [
  /\bTODO\b/i,
  /\bTO DO\b/i,
  /\bnext steps?\b/i,
  /\bopen question\b/i,
  /\bneed(?:s)? to\b/i,
  /\bfollow[- ]?up\b/i,
  /\bremaining\b.+\b(task|issue|question|work)\b/i,
  /\bfuture work\b/i,
  /\bpending\b/i,
  /\bverify\b/i,
  /\bconfirm\b/i
]

export function extractPhysicsConcepts(text: string): string[] {
  if (!text) return []

  const normalized = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')

  const words = new Set(normalized.split(/\W+/).filter(Boolean))
  const directMatches = PHYSICS_CONCEPT_TERMS.filter(term => words.has(term))

  return Array.from(new Set(directMatches))
}

export function buildConceptTags(content: string, existingTags: string[] = []): string[] {
  const normalizedExisting = existingTags.map(tag => tag.toLowerCase())
  const conceptTags = extractPhysicsConcepts(content)
  return Array.from(new Set([...normalizedExisting, ...conceptTags]))
}

export interface ContextDocument {
  id: string
  title: string
  content: string
  type: 'knowledge' | 'response'
  tags: string[]
  timestamp: string
  agent?: AgentName
  cycle?: number
  goalId?: string
}

export interface CollaborationContext {
  queryText: string
  documents: ContextDocument[]
  recentExchanges: AgentResponse[]
  goalHistory: AgentResponse[]
}

export function buildCollaborationContext(
  goal: PhysicsGoal,
  derivationHistory: AgentResponse[],
  knowledgeBase: KnowledgeEntry[],
  recentExchangeLimit = 4
): CollaborationContext {
  const goalHistory = derivationHistory.filter(response => response.goalId === goal.id)
  const recentExchanges = goalHistory
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(-recentExchangeLimit)

  const documents: ContextDocument[] = [
    ...knowledgeBase.map(entry => ({
      id: entry.id,
      title: entry.title,
      content: entry.content,
      type: 'knowledge' as const,
      tags: buildConceptTags(entry.content, entry.tags),
      timestamp: entry.timestamp,
      goalId: undefined
    })),
    ...goalHistory.map(response => ({
      id: response.id,
      title: `${response.agent} - Cycle ${response.cycle}`,
      content: response.content,
      type: 'response' as const,
      tags: buildConceptTags(response.content, [response.agent.toLowerCase(), `cycle-${response.cycle}`]),
      timestamp: response.timestamp,
      agent: response.agent,
      cycle: response.cycle,
      goalId: response.goalId
    }))
  ]

  const queryParts = [
    goal.title,
    goal.description,
    (goal.objectives || []).join(' '),
    (goal.constraints || []).join(' '),
    recentExchanges.map(entry => entry.content).join(' ')
  ]

  const queryText = queryParts.filter(Boolean).join(' ')

  return {
    queryText,
    documents,
    recentExchanges,
    goalHistory
  }
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 2 && !STOP_WORDS.has(token))
}

export function termFrequencyVector(tokens: string[]): Map<string, number> {
  return tokens.reduce((acc, token) => {
    acc.set(token, (acc.get(token) || 0) + 1)
    return acc
  }, new Map<string, number>())
}

export function cosineSimilarity(vecA: Map<string, number>, vecB: Map<string, number>): number {
  let dot = 0
  let magA = 0
  let magB = 0

  vecA.forEach((value, key) => {
    magA += value * value
    const other = vecB.get(key)
    if (other) {
      dot += value * other
    }
  })

  vecB.forEach(value => {
    magB += value * value
  })

  if (magA === 0 || magB === 0) return 0
  return dot / (Math.sqrt(magA) * Math.sqrt(magB))
}

export interface VectorMatch extends ContextDocument {
  similarity: number
}

export function rankVectorMatches(
  documents: ContextDocument[],
  queryText: string,
  limit = 5,
  similarityThreshold = 0.05
): VectorMatch[] {
  const queryTokens = tokenize(queryText)
  const queryVector = termFrequencyVector(queryTokens)

  const scored = documents.map(document => {
    const docTokens = tokenize(document.content)
    const docVector = termFrequencyVector(docTokens)
    const similarity = cosineSimilarity(queryVector, docVector)
    return { ...document, similarity }
  })

  return scored
    .filter(match => match.similarity >= similarityThreshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
}

export interface GraphInsight {
  anchor: VectorMatch
  related: {
    target: ContextDocument
    sharedTags: string[]
  }[]
}

export function deriveGraphInsights(
  anchorMatches: VectorMatch[],
  documents: ContextDocument[],
  maxRelatedPerAnchor = 3
): GraphInsight[] {
  if (anchorMatches.length === 0) return []

  const docMap = new Map(documents.map(doc => [doc.id, doc]))

  return anchorMatches.map(anchor => {
    const related = documents
      .filter(doc => doc.id !== anchor.id)
      .map(doc => {
        const sharedTags = anchor.tags.filter(tag => doc.tags.includes(tag))
        return { doc, sharedTags }
      })
      .filter(({ sharedTags }) => sharedTags.length > 0)
      .sort((a, b) => b.sharedTags.length - a.sharedTags.length)
      .slice(0, maxRelatedPerAnchor)
      .map(({ doc, sharedTags }) => ({
        target: doc,
        sharedTags
      }))

    const resolvedAnchor = docMap.get(anchor.id) || anchor

    return {
      anchor: { ...resolvedAnchor, similarity: anchor.similarity },
      related
    }
  })
}

export interface AgentKnowledgeContext {
  collaborationDigest: string
  vectorHighlights: string[]
  knowledgeGraphInsights: string[]
  collaborationFocus: string[]
}

export function formatAgentKnowledgeContext(
  context: CollaborationContext,
  vectorMatches: VectorMatch[],
  graphInsights: GraphInsight[],
  maxDigestEntries = 4,
  maxFocusEntries = 5
): AgentKnowledgeContext {
  const digestEntries = context.goalHistory
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(-maxDigestEntries)
    .map(entry => `Cycle ${entry.cycle} – ${entry.agent}: ${truncate(entry.content, 320)}`)

  const collaborationDigest = digestEntries.length > 0
    ? digestEntries.join('\n\n')
    : 'No prior collaboration for this goal yet.'

  const vectorHighlights = vectorMatches.map(match => {
    const header = match.type === 'knowledge'
      ? `Knowledge: ${match.title}`
      : `Agent ${match.agent} (Cycle ${match.cycle})`
    const similarity = match.similarity.toFixed(2)
    return `${header} [similarity ${similarity}]\n${truncate(match.content, 360)}`
  })

  const knowledgeGraphInsights = graphInsights
    .map(insight => {
      const anchorLabel = insight.anchor.type === 'knowledge'
        ? `Knowledge: ${insight.anchor.title}`
        : `Agent ${insight.anchor.agent} (Cycle ${insight.anchor.cycle})`
      if (insight.related.length === 0) {
        return `${anchorLabel} has no strongly connected items yet.`
      }
      const relations = insight.related.map(connection => {
        const target = connection.target.type === 'knowledge'
          ? `Knowledge: ${connection.target.title}`
          : `Agent ${connection.target.agent} (Cycle ${connection.target.cycle})`
        return `- ${target} (shared: ${connection.sharedTags.join(', ')})`
      })
      return `${anchorLabel} connects to:\n${relations.join('\n')}`
    })

  const focusCandidates = new Map<string, string>()

  context.recentExchanges.forEach(entry => {
    const highlights = extractFocusHighlights(entry.content)
    highlights.forEach(highlight => {
      const summary = truncate(highlight, 240)
      const label = `Cycle ${entry.cycle} – ${entry.agent}`
      focusCandidates.set(`${label}|${summary}`, `${label}: ${summary}`)
    })
  })

  vectorMatches
    .filter(match => match.type === 'knowledge')
    .forEach(match => {
      const highlights = extractFocusHighlights(match.content)
      highlights.forEach(highlight => {
        const summary = truncate(highlight, 240)
        const label = `Knowledge: ${match.title}`
        focusCandidates.set(`${label}|${summary}`, `${label}: ${summary}`)
      })
    })

  const collaborationFocus = Array.from(focusCandidates.values()).slice(0, maxFocusEntries)

  return {
    collaborationDigest,
    vectorHighlights,
    knowledgeGraphInsights,
    collaborationFocus
  }
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 1).trim()}\u2026`
}

function extractFocusHighlights(text: string): string[] {
  if (!text) {
    return []
  }

  const sanitized = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\s+/g, ' ')

  const lineCandidates = text
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .flatMap(line => {
      const withoutBullet = line.replace(/^[-*•]\s*/, '')
      const sentences = splitIntoSentences(withoutBullet)
      return sentences.length > 0 ? sentences : [withoutBullet]
    })

  const sentenceCandidates = sanitized
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map(sentence => sentence.trim())
    .filter(Boolean)

  const combined = [...lineCandidates, ...sentenceCandidates]
  const seen = new Set<string>()

  return combined.filter(candidate => {
    const normalized = candidate.replace(/\s+/g, ' ').trim()
    if (!normalized || seen.has(normalized.toLowerCase())) {
      return false
    }
    const matchesPattern = FOCUS_PATTERNS.some(pattern => pattern.test(normalized))
    const isQuestionFocus = normalized.includes('?') && /\b(should|what|why|how|could|need|whether)\b/i.test(normalized)
    if (matchesPattern || isQuestionFocus) {
      seen.add(normalized.toLowerCase())
      return true
    }
    return false
  })
}

function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map(sentence => sentence.trim())
    .filter(Boolean)
}
