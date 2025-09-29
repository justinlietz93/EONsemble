import { Lightning, Clock } from '@phosphor-icons/react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import type { AutonomousConfig } from '@/types/autonomous'

interface AutonomousSettingsPanelProps {
  config: AutonomousConfig
  defaultConfig: AutonomousConfig
  onChange: <Field extends keyof AutonomousConfig>(field: Field, value: AutonomousConfig[Field]) => void
  onInfoRequest: () => void
}

export function AutonomousSettingsPanel({
  config,
  defaultConfig,
  onChange,
  onInfoRequest
}: AutonomousSettingsPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightning className="h-5 w-5" />
          Autonomous Operation
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Configure the system to run continuously without manual intervention
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="autonomous-enabled" className="text-base font-medium">
              Autonomous Configuration
            </Label>
            <p className="text-sm text-muted-foreground">
              Configure settings for autonomous mode (start from Collaboration tab)
            </p>
          </div>
          <Switch id="autonomous-enabled" checked={config.enabled ?? false} onCheckedChange={onInfoRequest} disabled />
        </div>

        <Separator />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="max-cycles">Maximum Cycles</Label>
            <Input
              id="max-cycles"
              type="number"
              value={config.maxCycles ?? defaultConfig.maxCycles}
              onChange={event => onChange('maxCycles', Number.parseInt(event.target.value, 10))}
            />
            <p className="text-xs text-muted-foreground">0 = unlimited cycles</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="stop-on-gamma" className="text-sm font-medium">
                Stop on Phys-Gamma Decision
              </Label>
              <p className="text-xs text-muted-foreground">Allow Phys-Gamma to terminate the process</p>
            </div>
            <Switch
              id="stop-on-gamma"
              checked={config.stopOnGammaDecision ?? true}
              onCheckedChange={checked => onChange('stopOnGammaDecision', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="continue-overnight" className="text-sm font-medium">
                Continue Overnight
              </Label>
              <p className="text-xs text-muted-foreground">Keep running even during off-hours</p>
            </div>
            <Switch
              id="continue-overnight"
              checked={config.continueOvernight ?? true}
              onCheckedChange={checked => onChange('continueOvernight', checked)}
            />
          </div>
        </div>

        {config.enabled && (
          <div className="bg-accent/20 border border-accent rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-accent-foreground" />
              <span className="text-sm font-medium">Autonomous Mode Active</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              The system will run continuously without delays. Each agent will immediately start after the previous one finishes.
              Monitor progress in the Agent Collaboration tab.
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => onChange('enabled', false)}>
                Stop Autonomous Mode
              </Button>
            </div>
          </div>
        )}

        {!config.enabled && (
          <div className="bg-muted/50 border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Autonomous Mode Disabled</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Enable autonomous mode to have agents work continuously without manual intervention.
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => onChange('enabled', true)}>
                Start Autonomous Mode
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
