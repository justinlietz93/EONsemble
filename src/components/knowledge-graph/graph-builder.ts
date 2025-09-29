import { KnowledgeEntry, AgentResponse, PhysicsGoal } from '@/App'
import {
  extractPhysicsConcepts,
  tokenize,
  termFrequencyVector,
  cosineSimilarity
} from '@/lib/knowledge-utils'

import {
  GraphFilters,
  GraphModel,
  GraphNodeBase,
  GraphConnection,
  NodeConnection
} from './types'

interface BuildGraphParams {
  knowledgeBase: KnowledgeEntry[]
  derivationHistory: AgentResponse[]
  goals: PhysicsGoal[]
}

const MAX_STRONG_CONNECTIONS = 8
const CONCEPT_SIMILARITY_THRESHOLD = 0.18
const NARRATIVE_SIMILARITY_THRESHOLD = 0.22

export function buildGraphModel({
  knowledgeBase,
  derivationHistory,
  goals
}: BuildGraphParams): GraphModel {
  const nodes: GraphNodeBase[] = []
  const connections: GraphConnection[] = []

  goals.forEach(goal => {
    nodes.push({
      id: `goal-${goal.id}`,
      label: goal.title,
      type: 'goal',
      content: goal.description,
      connections: [],
      tags: [goal.domain],
      timestamp: goal.createdAt,
      radius: 15
    })
  })

  derivationHistory.forEach(response => {
    const concepts = extractPhysicsConcepts(response.content)
    nodes.push({
      id: `response-${response.id}`,
      label: `${response.agent} - Cycle ${response.cycle}`,
      type: 'agent_response',
      content: response.content,
      connections: [],
      tags: [response.agent.toLowerCase(), ...concepts],
      timestamp: response.timestamp,
      radius: 10
    })

    connections.push({
      source: `response-${response.id}`,
      target: `goal-${response.goalId}`,
      relationship: 'derives_from',
      strength: 0.85
    })

    concepts.forEach(concept => {
      const conceptId = `concept-${concept}`
      if (!nodes.find(n => n.id === conceptId)) {
        nodes.push({
          id: conceptId,
          label: concept,
          type: 'concept',
          connections: [],
          radius: 6
        })
      }
      connections.push({
        source: `response-${response.id}`,
        target: conceptId,
        relationship: 'contains_concept',
        strength: 0.65
      })
    })
  })

  knowledgeBase.forEach(entry => {
    const concepts = extractPhysicsConcepts(entry.content)
    nodes.push({
      id: `knowledge-${entry.id}`,
      label: entry.title,
      type: 'knowledge_entry',
      content: entry.content,
      connections: [],
      tags: [...entry.tags, ...concepts],
      timestamp: entry.timestamp,
      radius: 8
    })

    concepts.forEach(concept => {
      const conceptId = `concept-${concept}`
      if (!nodes.find(n => n.id === conceptId)) {
        nodes.push({
          id: conceptId,
          label: concept,
          type: 'concept',
          connections: [],
          radius: 6
        })
      }
      connections.push({
        source: `knowledge-${entry.id}`,
        target: conceptId,
        relationship: 'contains_concept',
        strength: 0.65
      })
    })
  })

  const responsesByGoal = derivationHistory.reduce((acc, response) => {
    if (!acc[response.goalId]) acc[response.goalId] = []
    acc[response.goalId].push(response)
    return acc
  }, {} as Record<string, AgentResponse[]>)

  Object.values(responsesByGoal).forEach(responses => {
    const sorted = responses.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )

    for (let i = 1; i < sorted.length; i++) {
      connections.push({
        source: `response-${sorted[i].id}`,
        target: `response-${sorted[i - 1].id}`,
        relationship: 'builds_on',
        strength: 0.8
      })
    }
  })

  const nodesById = new Map(nodes.map(node => [node.id, node]))

  const conceptContext = new Map<string, string>()
  connections.forEach(connection => {
    if (connection.relationship !== 'contains_concept') return
    const conceptNodeId = connection.source.startsWith('concept-')
      ? connection.source
      : connection.target
    const linkedNodeId = connection.source.startsWith('concept-')
      ? connection.target
      : connection.source

    const conceptNode = nodesById.get(conceptNodeId)
    const linkedNode = nodesById.get(linkedNodeId)
    if (!conceptNode || !linkedNode) return

    const linkedText = [linkedNode.label, linkedNode.content]
      .filter(Boolean)
      .join(' ')
    const existing = conceptContext.get(conceptNodeId) || ''
    conceptContext.set(conceptNodeId, `${existing} ${linkedText}`.trim())
  })

  const conceptNodes = nodes.filter(node => node.type === 'concept')
  const conceptVectors = new Map<string, Map<string, number>>()
  conceptNodes.forEach(node => {
    const text = conceptContext.get(node.id) || node.label
    const tokens = tokenize(text)
    conceptVectors.set(node.id, termFrequencyVector(tokens))
  })

  for (let i = 0; i < conceptNodes.length; i++) {
    for (let j = i + 1; j < conceptNodes.length; j++) {
      const vectorA = conceptVectors.get(conceptNodes[i].id)
      const vectorB = conceptVectors.get(conceptNodes[j].id)
      if (!vectorA || !vectorB) continue

      const similarity = cosineSimilarity(vectorA, vectorB)
      if (similarity >= CONCEPT_SIMILARITY_THRESHOLD) {
        connections.push({
          source: conceptNodes[i].id,
          target: conceptNodes[j].id,
          relationship: 'similar_to',
          strength: 0.35 + similarity * 0.5
        })
      }
    }
  }

  const narrativeNodes = nodes.filter(node =>
    (node.type === 'agent_response' || node.type === 'knowledge_entry') && node.content
  )
  const narrativeVectors = new Map<string, Map<string, number>>()
  narrativeNodes.forEach(node => {
    const tokens = tokenize(node.content || '')
    narrativeVectors.set(node.id, termFrequencyVector(tokens))
  })

  for (let i = 0; i < narrativeNodes.length; i++) {
    for (let j = i + 1; j < narrativeNodes.length; j++) {
      const vectorA = narrativeVectors.get(narrativeNodes[i].id)
      const vectorB = narrativeVectors.get(narrativeNodes[j].id)
      if (!vectorA || !vectorB) continue

      const similarity = cosineSimilarity(vectorA, vectorB)
      if (similarity >= NARRATIVE_SIMILARITY_THRESHOLD) {
        connections.push({
          source: narrativeNodes[i].id,
          target: narrativeNodes[j].id,
          relationship: 'similar_to',
          strength: 0.3 + similarity * 0.6
        })
      }
    }
  }

  const neighborMap = new Map<string, NodeConnection[]>()
  const registerNeighbor = (
    sourceId: string,
    targetId: string,
    relationship: GraphConnection['relationship'],
    strength: number
  ) => {
    if (!neighborMap.has(sourceId)) {
      neighborMap.set(sourceId, [])
    }
    const neighbors = neighborMap.get(sourceId)!
    const existing = neighbors.find(
      neighbor => neighbor.id === targetId && neighbor.relationship === relationship
    )
    if (existing) {
      existing.strength = Math.max(existing.strength, strength)
    } else {
      neighbors.push({ id: targetId, relationship, strength })
    }
  }

  connections.forEach(connection => {
    registerNeighbor(connection.source, connection.target, connection.relationship, connection.strength)
    registerNeighbor(connection.target, connection.source, connection.relationship, connection.strength)
  })

  neighborMap.forEach(neighbors => {
    neighbors.sort((a, b) => b.strength - a.strength)
    neighbors.forEach((neighbor, index) => {
      if (index < MAX_STRONG_CONNECTIONS) {
        neighbor.strength = Math.min(1, neighbor.strength * 1.05)
      } else {
        neighbor.strength = Math.max(0.1, neighbor.strength * 0.5)
      }
    })
  })

  nodes.forEach(node => {
    node.connections = neighborMap.get(node.id) || []
  })

  const connectionStrengthLookup = (source: string, target: string) => {
    const neighbors = neighborMap.get(source)
    if (!neighbors) return undefined
    const match = neighbors.find(neighbor => neighbor.id === target)
    return match?.strength
  }

  connections.forEach(connection => {
    const forward = connectionStrengthLookup(connection.source, connection.target)
    const reverse = connectionStrengthLookup(connection.target, connection.source)
    const updatedStrength = Math.max(
      forward ?? connection.strength,
      reverse ?? connection.strength
    )
    connection.strength = Math.min(1, updatedStrength)
  })

  return { nodes, connections }
}

export function filterGraphModel(model: GraphModel, filters: GraphFilters): GraphModel {
  const { nodes, connections } = model
  const { searchQuery, nodeTypeFilter, maxNodes } = filters

  let filteredNodes = nodes.filter(node => {
    const matchesSearch =
      searchQuery === '' ||
      node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesType = nodeTypeFilter === 'all' || node.type === nodeTypeFilter
    return matchesSearch && matchesType
  })

  if (filteredNodes.length > maxNodes) {
    filteredNodes = [...filteredNodes]
      .sort((a, b) => {
        const aConnections = a.connections.length
        const bConnections = b.connections.length
        if (aConnections !== bConnections) return bConnections - aConnections

        const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0
        const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0
        return bTime - aTime
      })
      .slice(0, maxNodes)
  }

  const filteredNodeIds = new Set(filteredNodes.map(n => n.id))

  const filteredConnections = connections.filter(
    conn => filteredNodeIds.has(conn.source) && filteredNodeIds.has(conn.target)
  )

  const nodesWithFilteredNeighbors = filteredNodes.map(node => ({
    ...node,
    connections: node.connections.filter(connection => filteredNodeIds.has(connection.id))
  }))

  return {
    nodes: nodesWithFilteredNeighbors,
    connections: filteredConnections
  }
}
