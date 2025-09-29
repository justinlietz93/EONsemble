export type GraphNodeType = 'goal' | 'agent_response' | 'knowledge_entry' | 'concept'

export type GraphRelationship =
  | 'derives_from'
  | 'references'
  | 'builds_on'
  | 'contradicts'
  | 'contains_concept'
  | 'similar_to'

export interface NodeConnection {
  id: string
  strength: number
  relationship: GraphRelationship
}

export interface GraphNodeBase {
  id: string
  label: string
  type: GraphNodeType
  content?: string
  connections: NodeConnection[]
  tags?: string[]
  timestamp?: string
  radius?: number
}

export interface GraphNodeWithLayout extends GraphNodeBase {
  x?: number
  y?: number
  vx?: number
  vy?: number
}

export interface GraphConnection {
  source: string
  target: string
  relationship: GraphRelationship
  strength: number
}

export interface GraphModel {
  nodes: GraphNodeBase[]
  connections: GraphConnection[]
}

export interface GraphFilters {
  searchQuery: string
  nodeTypeFilter: string
  maxNodes: number
}
