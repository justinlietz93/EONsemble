import { GraphRelationship, GraphNodeType } from './types'

const NODE_TYPE_META: Record<GraphNodeType, { label: string; color: string }> = {
  goal: { label: 'Goal', color: 'bg-blue-500' },
  agent_response: { label: 'Agent Response', color: 'bg-green-500' },
  knowledge_entry: { label: 'Knowledge Entry', color: 'bg-purple-500' },
  concept: { label: 'Concept', color: 'bg-yellow-500' }
}

const RELATIONSHIP_LABELS: Record<GraphRelationship, string> = {
  derives_from: 'Derives From',
  references: 'References',
  builds_on: 'Builds On',
  contradicts: 'Contradicts',
  contains_concept: 'Contains Concept',
  similar_to: 'Similarity'
}

export const getNodeTypeLabel = (type: GraphNodeType) => NODE_TYPE_META[type]?.label ?? type

export const getNodeTypeColor = (type: GraphNodeType) => NODE_TYPE_META[type]?.color ?? 'bg-gray-500'

export const formatRelationship = (relationship: GraphRelationship) =>
  RELATIONSHIP_LABELS[relationship] ?? 'Linked'
