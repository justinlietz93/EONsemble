import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { FileText, Target, CheckCircle, List } from '@phosphor-icons/react'

export function GoalContractSchema() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" weight="duotone" />
            Goal Contract JSON Schema
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-lg">Schema Definition</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-mono text-sm bg-background p-4 rounded-lg overflow-x-auto">
                <div className="space-y-1">
                  <div className="text-green-600">// Goal Contract Schema v1.0</div>
                  <div>{"{"}</div>
                  <div className="ml-2">"$schema": "http://json-schema.org/draft-07/schema#",</div>
                  <div className="ml-2">"type": "object",</div>
                  <div className="ml-2">"title": "Physics Derivation Goal Contract",</div>
                  <div className="ml-2">"required": ["goal_id", "objective", "scope", "constraints"],</div>
                  <div className="ml-2">"properties": {"{"}</div>
                  <div className="ml-4">"goal_id": {"{"}</div>
                  <div className="ml-6">"type": "string",</div>
                  <div className="ml-6">"description": "Unique identifier for this goal"</div>
                  <div className="ml-4">{"},"},</div>
                  <div className="ml-4">"timestamp": {"{"}</div>
                  <div className="ml-6">"type": "string",</div>
                  <div className="ml-6">"format": "date-time",</div>
                  <div className="ml-6">"description": "Goal creation timestamp"</div>
                  <div className="ml-4">{"},"},</div>
                  <div className="ml-4">"objective": {"{"}</div>
                  <div className="ml-6">"type": "object",</div>
                  <div className="ml-6">"required": ["primary_goal", "success_criteria"],</div>
                  <div className="ml-6">"properties": {"{"}</div>
                  <div className="ml-8">"primary_goal": {"{"}</div>
                  <div className="ml-10">"type": "string",</div>
                  <div className="ml-10">"description": "Main physics derivation objective"</div>
                  <div className="ml-8">{"},"},</div>
                  <div className="ml-8">"secondary_goals": {"{"}</div>
                  <div className="ml-10">"type": "array",</div>
                  <div className="ml-10">"items": {"{"} "type": "string" {"}"},</div>
                  <div className="ml-10">"description": "Optional supporting objectives"</div>
                  <div className="ml-8">{"},"},</div>
                  <div className="ml-8">"success_criteria": {"{"}</div>
                  <div className="ml-10">"type": "array",</div>
                  <div className="ml-10">"items": {"{"} "type": "string" {"}"},</div>
                  <div className="ml-10">"description": "Measurable success indicators"</div>
                  <div className="ml-8">{"}"}</div>
                  <div className="ml-6">{"}"}</div>
                  <div className="ml-4">{"},"},</div>
                  <div className="ml-4">"scope": {"{"}</div>
                  <div className="ml-6">"type": "object",</div>
                  <div className="ml-6">"properties": {"{"}</div>
                  <div className="ml-8">"physics_domains": {"{"}</div>
                  <div className="ml-10">"type": "array",</div>
                  <div className="ml-10">"items": {"{"}</div>
                  <div className="ml-12">"type": "string",</div>
                  <div className="ml-12">"enum": ["quantum_mechanics", "classical_mechanics",</div>
                  <div className="ml-12">       "electromagnetism", "thermodynamics", "relativity",</div>
                  <div className="ml-12">       "statistical_mechanics", "optics", "acoustics"]</div>
                  <div className="ml-10">{"}"},</div>
                  <div className="ml-10">"description": "Relevant physics domains"</div>
                  <div className="ml-8">{"},"},</div>
                  <div className="ml-8">"mathematical_level": {"{"}</div>
                  <div className="ml-10">"type": "string",</div>
                  <div className="ml-10">"enum": ["undergraduate", "graduate", "research"],</div>
                  <div className="ml-10">"description": "Expected mathematical complexity"</div>
                  <div className="ml-8">{"},"},</div>
                  <div className="ml-8">"excluded_topics": {"{"}</div>
                  <div className="ml-10">"type": "array",</div>
                  <div className="ml-10">"items": {"{"} "type": "string" {"}"},</div>
                  <div className="ml-10">"description": "Topics to avoid or exclude"</div>
                  <div className="ml-8">{"}"}</div>
                  <div className="ml-6">{"}"}</div>
                  <div className="ml-4">{"},"},</div>
                  <div className="ml-4">"constraints": {"{"}</div>
                  <div className="ml-6">"type": "object",</div>
                  <div className="ml-6">"properties": {"{"}</div>
                  <div className="ml-8">"max_cycles": {"{"}</div>
                  <div className="ml-10">"type": "integer",</div>
                  <div className="ml-10">"minimum": 1,</div>
                  <div className="ml-10">"maximum": 50,</div>
                  <div className="ml-10">"default": 10</div>
                  <div className="ml-8">{"},"},</div>
                  <div className="ml-8">"max_duration_minutes": {"{"}</div>
                  <div className="ml-10">"type": "integer",</div>
                  <div className="ml-10">"minimum": 5,</div>
                  <div className="ml-10">"maximum": 180,</div>
                  <div className="ml-10">"default": 60</div>
                  <div className="ml-8">{"},"},</div>
                  <div className="ml-8">"quality_threshold": {"{"}</div>
                  <div className="ml-10">"type": "number",</div>
                  <div className="ml-10">"minimum": 0.0,</div>
                  <div className="ml-10">"maximum": 1.0,</div>
                  <div className="ml-10">"default": 0.8</div>
                  <div className="ml-8">{"},"},</div>
                  <div className="ml-8">"required_rigor": {"{"}</div>
                  <div className="ml-10">"type": "string",</div>
                  <div className="ml-10">"enum": ["high", "medium", "low"],</div>
                  <div className="ml-10">"default": "high"</div>
                  <div className="ml-8">{"}"}</div>
                  <div className="ml-6">{"}"}</div>
                  <div className="ml-4">{"},"},</div>
                  <div className="ml-4">"preferences": {"{"}</div>
                  <div className="ml-6">"type": "object",</div>
                  <div className="ml-6">"properties": {"{"}</div>
                  <div className="ml-8">"derivation_style": {"{"}</div>
                  <div className="ml-10">"type": "string",</div>
                  <div className="ml-10">"enum": ["analytical", "geometric", "computational"],</div>
                  <div className="ml-10">"default": "analytical"</div>
                  <div className="ml-8">{"},"},</div>
                  <div className="ml-8">"presentation_format": {"{"}</div>
                  <div className="ml-10">"type": "string",</div>
                  <div className="ml-10">"enum": ["formal", "pedagogical", "research"],</div>
                  <div className="ml-10">"default": "formal"</div>
                  <div className="ml-8">{"},"},</div>
                  <div className="ml-8">"include_examples": {"{"}</div>
                  <div className="ml-10">"type": "boolean",</div>
                  <div className="ml-10">"default": true</div>
                  <div className="ml-8">{"}"}</div>
                  <div className="ml-6">{"}"}</div>
                  <div className="ml-4">{"},"},</div>
                  <div className="ml-4">"metadata": {"{"}</div>
                  <div className="ml-6">"type": "object",</div>
                  <div className="ml-6">"properties": {"{"}</div>
                  <div className="ml-8">"user_id": {"{"} "type": "string" {"}"},</div>
                  <div className="ml-8">"session_id": {"{"} "type": "string" {"}"},</div>
                  <div className="ml-8">"version": {"{"} "type": "string", "default": "1.0" {"}"}</div>
                  <div className="ml-6">{"}"}</div>
                  <div className="ml-4">{"}"}</div>
                  <div className="ml-2">{"}"}</div>
                  <div>{"}"}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Example Goal Contract
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="font-mono text-sm bg-muted/50 p-4 rounded-lg">
                  <div className="space-y-1">
                    <div>{"{"}</div>
                    <div className="ml-2">"goal_id": "derive_maxwell_equations",</div>
                    <div className="ml-2">"timestamp": "2024-12-19T10:30:00Z",</div>
                    <div className="ml-2">"objective": {"{"}</div>
                    <div className="ml-4">"primary_goal": "Derive Maxwell's equations from first principles",</div>
                    <div className="ml-4">"secondary_goals": [</div>
                    <div className="ml-6">"Show connection to Coulomb's law",</div>
                    <div className="ml-6">"Demonstrate gauge freedom"</div>
                    <div className="ml-4">],</div>
                    <div className="ml-4">"success_criteria": [</div>
                    <div className="ml-6">"All four Maxwell equations derived",</div>
                    <div className="ml-6">"Physical interpretation provided",</div>
                    <div className="ml-6">"Mathematical rigor maintained"</div>
                    <div className="ml-4">]</div>
                    <div className="ml-2">{"},"},</div>
                    <div className="ml-2">"scope": {"{"}</div>
                    <div className="ml-4">"physics_domains": ["electromagnetism"],</div>
                    <div className="ml-4">"mathematical_level": "graduate",</div>
                    <div className="ml-4">"excluded_topics": ["quantum_field_theory"]</div>
                    <div className="ml-2">{"},"},</div>
                    <div className="ml-2">"constraints": {"{"}</div>
                    <div className="ml-4">"max_cycles": 15,</div>
                    <div className="ml-4">"max_duration_minutes": 90,</div>
                    <div className="ml-4">"quality_threshold": 0.85,</div>
                    <div className="ml-4">"required_rigor": "high"</div>
                    <div className="ml-2">{"},"},</div>
                    <div className="ml-2">"preferences": {"{"}</div>
                    <div className="ml-4">"derivation_style": "analytical",</div>
                    <div className="ml-4">"presentation_format": "formal",</div>
                    <div className="ml-4">"include_examples": true</div>
                    <div className="ml-2">{"}"}</div>
                    <div>{"}"}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Validation Rules
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Required Fields</h4>
                    <div className="space-y-1">
                      <Badge variant="outline" className="text-xs">goal_id</Badge>
                      <Badge variant="outline" className="text-xs">objective.primary_goal</Badge>
                      <Badge variant="outline" className="text-xs">objective.success_criteria</Badge>
                      <Badge variant="outline" className="text-xs">constraints</Badge>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-semibold text-sm mb-2">Constraint Validation</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs">Max Cycles</span>
                        <Badge variant="secondary" className="text-xs">1-50</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs">Duration</span>
                        <Badge variant="secondary" className="text-xs">5-180 min</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs">Quality Threshold</span>
                        <Badge variant="secondary" className="text-xs">0.0-1.0</Badge>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-semibold text-sm mb-2">Enum Values</h4>
                    <div className="space-y-2">
                      <div className="text-xs">
                        <span className="font-medium">Physics Domains:</span>
                        <div className="mt-1 text-muted-foreground">quantum_mechanics, classical_mechanics, electromagnetism, thermodynamics, relativity, statistical_mechanics, optics, acoustics</div>
                      </div>
                      <div className="text-xs">
                        <span className="font-medium">Math Level:</span>
                        <div className="mt-1 text-muted-foreground">undergraduate, graduate, research</div>
                      </div>
                      <div className="text-xs">
                        <span className="font-medium">Derivation Style:</span>
                        <div className="mt-1 text-muted-foreground">analytical, geometric, computational</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <List className="h-5 w-5 text-accent" />
                Usage Guidelines
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm">Contract Creation Process</h4>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="text-xs">1</Badge>
                      <div className="text-sm">
                        <div className="font-medium">User Input</div>
                        <div className="text-xs text-muted-foreground">Free-form goal description</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="text-xs">2</Badge>
                      <div className="text-sm">
                        <div className="font-medium">LLM Processing</div>
                        <div className="text-xs text-muted-foreground">Extract structured information</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="text-xs">3</Badge>
                      <div className="text-sm">
                        <div className="font-medium">Schema Validation</div>
                        <div className="text-xs text-muted-foreground">Ensure compliance with rules</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="text-xs">4</Badge>
                      <div className="text-sm">
                        <div className="font-medium">User Confirmation</div>
                        <div className="text-xs text-muted-foreground">Review and approve contract</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-sm">Best Practices</h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" weight="fill" />
                      <span className="text-sm">Be specific in primary goals</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" weight="fill" />
                      <span className="text-sm">Define measurable success criteria</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" weight="fill" />
                      <span className="text-sm">Set realistic time and cycle limits</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" weight="fill" />
                      <span className="text-sm">Specify appropriate rigor level</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" weight="fill" />
                      <span className="text-sm">Include relevant physics domains</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" weight="fill" />
                      <span className="text-sm">Exclude irrelevant topics explicitly</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  )
}