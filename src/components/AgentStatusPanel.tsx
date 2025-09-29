import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { User, Pause, Play } from '@phosphor-icons/react'
import { AgentName } from '@/components/AutonomousEngine'

// Agent configurations
const AGENTS = {
  'Phys-Alpha': {
    name: 'Phys-Alpha',
    role: 'Initiator & Primary Derivator',
    color: 'bg-blue-500',
    description: 'Initiates physics derivations and establishes foundational approaches'
  },
  'Phys-Beta': {
    name: 'Phys-Beta', 
    role: 'Contributor & Extender',
    color: 'bg-green-500',
    description: 'Builds upon and extends existing derivations with additional insights'
  },
  'Phys-Gamma': {
    name: 'Phys-Gamma',
    role: 'Oversight & Corrector',
    color: 'bg-purple-500',
    description: 'Provides oversight, corrections, and ensures scientific rigor'
  }
} as const

interface AgentStatusPanelProps {
  currentAgent: AgentName
  currentCycle: number
  isRunning: boolean
  isAutonomous: boolean
  autonomousStatus: string
  progress?: number
  onRunSingleTurn: () => void
  onStartAutonomous: () => void
  onStopAutonomous: () => void
}

export function AgentStatusPanel({
  currentAgent,
  currentCycle,
  isRunning,
  isAutonomous,
  autonomousStatus,
  progress = 0,
  onRunSingleTurn,
  onStartAutonomous,
  onStopAutonomous
}: AgentStatusPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Agent Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span>Cycle</span>
            <span>{currentCycle}</span>
          </div>
          <div className="flex justify-between text-sm mb-2">
            <span>Active Agent</span>
            <Badge className={AGENTS[currentAgent].color}>
              {currentAgent}
            </Badge>
          </div>
        </div>
        
        {(isAutonomous || autonomousStatus) && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Autonomous Status</span>
              <Badge variant="secondary" className="text-xs">
                {isAutonomous ? 'RUNNING' : 'PAUSED'}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
              {autonomousStatus || 'Autonomous mode is idle.'}
            </div>
          </div>
        )}
        
        {isRunning && (
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        <div className="flex gap-2">
          {isAutonomous ? (
            <>
              <Button
                onClick={onRunSingleTurn}
                disabled={isRunning}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                {isRunning ? (
                  <>
                    <Pause className="h-4 w-4 mr-1" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-1" />
                    Single Turn
                  </>
                )}
              </Button>
              <Button
                onClick={onStopAutonomous}
                variant="destructive"
                size="sm"
                className="flex-1"
              >
                <Pause className="h-4 w-4 mr-1" />
                Stop Auto
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={onRunSingleTurn}
                disabled={isRunning}
                size="sm"
                className="flex-1"
              >
                {isRunning ? (
                  <>
                    <Pause className="h-4 w-4 mr-1" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-1" />
                    Run Turn
                  </>
                )}
              </Button>
              <Button
                onClick={onStartAutonomous}
                disabled={isRunning}
                variant="secondary"
                size="sm"
                className="flex-1"
              >
                Start Auto
              </Button>
            </>
          )}
        </div>

        <Separator />
        
        <div className="space-y-3">
          {Object.entries(AGENTS).map(([key, agent]) => (
            <div key={key} className="flex items-start gap-3">
              <div className={`w-3 h-3 rounded-full ${agent.color} mt-1`} />
              <div>
                <p className="text-sm font-medium">{agent.name}</p>
                <p className="text-xs text-muted-foreground">{agent.role}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}