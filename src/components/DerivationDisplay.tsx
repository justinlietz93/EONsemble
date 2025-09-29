import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Brain, Clock } from '@phosphor-icons/react'
import { AgentResponse } from '@/App'
import { LaTeXRenderer } from '@/components/LaTeXRenderer'
import { hasLaTeX } from '@/lib/latex'

// Agent configurations for colors
const AGENTS = {
  'Phys-Alpha': {
    color: 'bg-blue-500'
  },
  'Phys-Beta': {
    color: 'bg-green-500'
  },
  'Phys-Gamma': {
    color: 'bg-purple-500'
  }
} as const

interface DerivationDisplayProps {
  goalHistory: AgentResponse[]
  goalTitle?: string
}

export function DerivationDisplay({ goalHistory, goalTitle }: DerivationDisplayProps) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          Current Derivation Progress
          {goalTitle && (
            <span className="text-sm font-normal text-muted-foreground">
              - {goalTitle}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          {goalHistory.length > 0 ? (
            <div className="space-y-4">
              {goalHistory.map((response) => (
                <div key={response.id} className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={AGENTS[response.agent].color}>
                      {response.agent}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      Cycle {response.cycle}
                    </span>
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(response.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-sm">
                    {hasLaTeX(response.content) ? (
                      <LaTeXRenderer content={response.content} />
                    ) : (
                      <div className="whitespace-pre-wrap">{response.content}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No derivation work yet. Start the collaboration to begin.
              </p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}