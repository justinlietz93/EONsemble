import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'

import { GraphNodeWithLayout } from './types'
import { formatRelationship, getNodeTypeColor, getNodeTypeLabel } from './nodePresentation'
import { ProminentConnectionSummary } from './selectors'

interface NodeDetailsCardProps {
  node: GraphNodeWithLayout
  prominentConnections: ProminentConnectionSummary[]
  onSelectConnection: (nodeId: string) => void
}

export function NodeDetailsCard({
  node,
  prominentConnections,
  onSelectConnection
}: NodeDetailsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Badge className={getNodeTypeColor(node.type)}>{getNodeTypeLabel(node.type)}</Badge>
          <span className="text-sm">{node.label}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {node.content && (
          <div>
            <p className="text-sm font-medium mb-2">Content</p>
            <ScrollArea className="max-h-32">
              <p className="text-sm text-muted-foreground">
                {node.content.substring(0, 200)}
                {node.content.length > 200 && '...'}
              </p>
            </ScrollArea>
          </div>
        )}

        {node.tags && node.tags.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Tags/Concepts</p>
            <div className="flex flex-wrap gap-1">
              {node.tags.map(tag => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-sm font-medium mb-2">Connections</p>
          <p className="text-sm text-muted-foreground">
            {node.connections.length} connected nodes
          </p>
          {prominentConnections.length > 0 && (
            <div className="mt-2 space-y-1">
              {prominentConnections.map(connection => (
                <button
                  key={connection.id}
                  type="button"
                  onClick={() => onSelectConnection(connection.id)}
                  className="flex flex-col rounded-md border border-muted/40 px-2 py-1 text-left hover:border-muted"
                >
                  <span className="text-sm font-medium">{connection.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatRelationship(connection.relationship)} • Strength{' '}
                    {connection.strength.toFixed(2)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {node.timestamp && (
          <div>
            <p className="text-sm font-medium mb-2">Timestamp</p>
            <p className="text-sm text-muted-foreground">{node.timestamp}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
