import { GraphNodeWithLayout, GraphRelationship, GraphNodeType } from './types'

export interface ProminentConnectionSummary {
  id: string
  label: string
  relationship: GraphRelationship
  strength: number
  type: GraphNodeType
}

export const getProminentConnections = (
  selectedNode: GraphNodeWithLayout | null,
  nodes: GraphNodeWithLayout[]
): ProminentConnectionSummary[] => {
  if (!selectedNode) return []

  return selectedNode.connections
    .map(connection => {
      const target = nodes.find(node => node.id === connection.id)
      if (!target) return null
      return {
        id: connection.id,
        label: target.label,
        relationship: connection.relationship,
        strength: connection.strength,
        type: target.type
      }
    })
    .filter((item): item is ProminentConnectionSummary => item !== null)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 6)
}
