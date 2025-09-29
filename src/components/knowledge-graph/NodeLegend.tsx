import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { getNodeTypeColor, getNodeTypeLabel } from './nodePresentation'
import { GraphNodeType } from './types'

const NODE_TYPES: GraphNodeType[] = ['goal', 'agent_response', 'knowledge_entry', 'concept']

export function NodeLegend() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Node Types</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {NODE_TYPES.map(type => (
          <div key={type} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${getNodeTypeColor(type)}`} />
            <span className="text-sm">{getNodeTypeLabel(type)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
