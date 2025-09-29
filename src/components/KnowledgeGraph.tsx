import { useCallback, useEffect, useMemo, useState } from 'react'
import { Network, MagnifyingGlass, Link, ArrowsOut, ArrowsIn } from '@phosphor-icons/react'

import { KnowledgeEntry, AgentResponse, PhysicsGoal } from '@/App'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'

import { GraphCanvas } from './knowledge-graph/GraphCanvas'
import { NodeDetailsCard } from './knowledge-graph/NodeDetailsCard'
import { NodeLegend } from './knowledge-graph/NodeLegend'
import { getProminentConnections } from './knowledge-graph/selectors'
import { buildGraphModel, filterGraphModel } from './knowledge-graph/graph-builder'
import { useGraphLayout } from './knowledge-graph/useGraphLayout'
import { GraphFilters, GraphNodeWithLayout } from './knowledge-graph/types'

interface KnowledgeGraphProps {
  knowledgeBase: KnowledgeEntry[]
  derivationHistory: AgentResponse[]
  goals: PhysicsGoal[]
}

const DEFAULT_FILTERS: GraphFilters = {
  searchQuery: '',
  nodeTypeFilter: 'all',
  maxNodes: 100
}

export function KnowledgeGraph({ knowledgeBase, derivationHistory, goals }: KnowledgeGraphProps) {
  const [searchQuery, setSearchQuery] = useState(DEFAULT_FILTERS.searchQuery)
  const [nodeTypeFilter, setNodeTypeFilter] = useState(DEFAULT_FILTERS.nodeTypeFilter)
  const [maxNodes, setMaxNodes] = useState(DEFAULT_FILTERS.maxNodes)
  const [zoom, setZoom] = useState(0.5)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  const baseGraph = useMemo(
    () => buildGraphModel({ knowledgeBase, derivationHistory, goals }),
    [knowledgeBase, derivationHistory, goals]
  )

  const filters = useMemo(
    () => ({ searchQuery, nodeTypeFilter, maxNodes }),
    [searchQuery, nodeTypeFilter, maxNodes]
  )

  const filteredGraph = useMemo(
    () => filterGraphModel(baseGraph, filters),
    [baseGraph, filters]
  )

  const layoutNodes = useGraphLayout(filteredGraph.nodes, filteredGraph.connections)

  useEffect(() => {
    if (!selectedNodeId) return
    const exists = layoutNodes.some(node => node.id === selectedNodeId)
    if (!exists) {
      setSelectedNodeId(null)
    }
  }, [layoutNodes, selectedNodeId])

  const selectedNode = useMemo<GraphNodeWithLayout | null>(
    () => layoutNodes.find(node => node.id === selectedNodeId) ?? null,
    [layoutNodes, selectedNodeId]
  )

  const prominentConnections = useMemo(
    () => getProminentConnections(selectedNode, layoutNodes),
    [selectedNode, layoutNodes]
  )

  const handleSelectNode = useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId)
  }, [])

  const handleConnectionSelect = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId)
  }, [])

  const handlePanChange = useCallback((x: number, y: number) => {
    setPanX(x)
    setPanY(y)
  }, [])

  const handleZoomChange = useCallback((value: number) => {
    setZoom(value)
  }, [])

  const resetView = useCallback(() => {
    setZoom(0.5)
    setPanX(0)
    setPanY(0)
    setSelectedNodeId(null)
  }, [])

  const handleMaxNodesChange = useCallback((value: number[]) => {
    if (value.length === 0) return
    setMaxNodes(value[0])
  }, [])

  const totalConnections = filteredGraph.connections.length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Network className="h-6 w-6" />
            Knowledge Graph
          </h2>
          <p className="text-muted-foreground">
            {layoutNodes.length} nodes • {totalConnections} connections
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="flex items-center gap-2">
          <MagnifyingGlass className="h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            placeholder="Search nodes..."
            className="text-sm"
          />
        </div>

        <Select value={nodeTypeFilter} onValueChange={setNodeTypeFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="goal">Goals</SelectItem>
            <SelectItem value="agent_response">Agent Responses</SelectItem>
            <SelectItem value="knowledge_entry">Knowledge Entries</SelectItem>
            <SelectItem value="concept">Concepts</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Max Nodes:</span>
          <Slider
            value={[maxNodes]}
            onValueChange={handleMaxNodesChange}
            max={500}
            min={10}
            step={10}
            className="flex-1"
          />
          <span className="text-sm w-8">{maxNodes}</span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setZoom(Math.max(0.1, zoom - 0.2))}>
            <ArrowsIn className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">{Math.round(zoom * 100)}%</span>
          <Button variant="outline" size="sm" onClick={() => setZoom(Math.min(3, zoom + 0.2))}>
            <ArrowsOut className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={resetView} title="Reset view">
            Reset
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <Card className="h-[800px]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5" />
                Interactive Graph Visualization
                <span className="text-sm text-muted-foreground ml-auto">
                  Drag to pan • Scroll to zoom • Click nodes for details
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 h-[720px]">
              <GraphCanvas
                nodes={layoutNodes}
                connections={filteredGraph.connections}
                zoom={zoom}
                panX={panX}
                panY={panY}
                selectedNodeId={selectedNodeId ?? undefined}
                onSelectNode={handleSelectNode}
                onPanChange={handlePanChange}
                onZoomChange={handleZoomChange}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <NodeLegend />

          {selectedNode ? (
            <NodeDetailsCard
              node={selectedNode}
              prominentConnections={prominentConnections}
              onSelectConnection={handleConnectionSelect}
            />
          ) : (
            <Card className="flex h-48 items-center justify-center text-center text-muted-foreground">
              <div>
                <Link className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p>Select a node to view its details and relationships.</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
