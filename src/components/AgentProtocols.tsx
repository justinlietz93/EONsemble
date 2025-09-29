import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { GitBranch, ArrowRight, Clock, CheckCircle, Warning } from '@phosphor-icons/react'

export function AgentProtocols() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" weight="duotone" />
            Agent Interaction Protocol Specification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-lg">Cycle State Machine</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-7 gap-4 items-center">
                  <Card className="p-3 bg-primary/10 border-primary/20">
                    <div className="text-center">
                      <Badge className="mb-2">Alpha Turn</Badge>
                      <div className="text-xs text-muted-foreground">Initiate/Derive</div>
                    </div>
                  </Card>
                  <ArrowRight className="mx-auto text-muted-foreground" />
                  <Card className="p-3 bg-secondary/10 border-secondary/20">
                    <div className="text-center">
                      <Badge variant="secondary" className="mb-2">Beta Turn</Badge>
                      <div className="text-xs text-muted-foreground">Extend/Build</div>
                    </div>
                  </Card>
                  <ArrowRight className="mx-auto text-muted-foreground" />
                  <Card className="p-3 bg-primary/10 border-primary/20">
                    <div className="text-center">
                      <Badge className="mb-2">Alpha Turn</Badge>
                      <div className="text-xs text-muted-foreground">Continue</div>
                    </div>
                  </Card>
                  <ArrowRight className="mx-auto text-muted-foreground" />
                  <Card className="p-3 bg-secondary/10 border-secondary/20">
                    <div className="text-center">
                      <Badge variant="secondary" className="mb-2">Beta Turn</Badge>
                      <div className="text-xs text-muted-foreground">Extend</div>
                    </div>
                  </Card>
                </div>
                
                <div className="flex justify-center">
                  <div className="text-center">
                    <div className="w-px h-8 bg-border mx-auto"></div>
                    <div className="text-xs text-muted-foreground">After 2 full cycles</div>
                  </div>
                </div>

                <Card className="p-4 bg-accent/10 border-accent/20">
                  <div className="text-center">
                    <Badge variant="outline" className="border-accent mb-2">Gamma Intervention</Badge>
                    <div className="text-sm text-muted-foreground">Review, Correct, and Oversee</div>
                  </div>
                </Card>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Protocol States</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-green-600" weight="fill" />
                    <div>
                      <div className="font-medium text-sm">ACTIVE</div>
                      <div className="text-xs text-muted-foreground">Agent is processing and deriving</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-blue-600" weight="fill" />
                    <div>
                      <div className="font-medium text-sm">WAITING</div>
                      <div className="text-xs text-muted-foreground">Awaiting context assembly</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Warning className="h-4 w-4 text-yellow-600" weight="fill" />
                    <div>
                      <div className="font-medium text-sm">INTERVENTION</div>
                      <div className="text-xs text-muted-foreground">Gamma oversight required</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Context Flow</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="text-xs">1</Badge>
                    <div>
                      <div className="font-medium text-sm">Vector Similarity Search</div>
                      <div className="text-xs text-muted-foreground">Retrieve relevant knowledge chunks</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="text-xs">2</Badge>
                    <div>
                      <div className="font-medium text-sm">Knowledge Graph Traversal</div>
                      <div className="text-xs text-muted-foreground">Find structured relationships</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="text-xs">3</Badge>
                    <div>
                      <div className="font-medium text-sm">Previous Agent Output</div>
                      <div className="text-xs text-muted-foreground">Include immediate prior work</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="text-xs">4</Badge>
                    <div>
                      <div className="font-medium text-sm">Goal Contract Check</div>
                      <div className="text-xs text-muted-foreground">Ensure alignment with objectives</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sequence Diagram: Two-Cycle Flow</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-mono text-sm bg-muted/50 p-4 rounded-lg overflow-x-auto">
                <div className="space-y-1">
                  <div>User → System: Initialize with goal + corpus</div>
                  <div>System → Context: Assemble initial context</div>
                  <div>Context → Phys-Alpha: Provide context package</div>
                  <div>Phys-Alpha → Knowledge: Store derivation</div>
                  <div>System → Context: Update with Alpha output</div>
                  <div>Context → Phys-Beta: Provide enhanced context</div>
                  <div>Phys-Beta → Knowledge: Store extension</div>
                  <div className="text-muted-foreground">// Cycle 1 complete</div>
                  <div>System → Context: Assemble for cycle 2</div>
                  <div>Context → Phys-Alpha: Provide context + history</div>
                  <div>Phys-Alpha → Knowledge: Store continuation</div>
                  <div>System → Context: Update context</div>
                  <div>Context → Phys-Beta: Enhanced context</div>
                  <div>Phys-Beta → Knowledge: Store extension</div>
                  <div className="text-muted-foreground">// Cycle 2 complete - Trigger Gamma</div>
                  <div className="text-accent">System → Phys-Gamma: Full history review</div>
                  <div className="text-accent">Phys-Gamma → System: Corrections/approval</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Intervention Logic</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 border-yellow-200 bg-yellow-50">
                  <h4 className="font-semibold text-sm mb-2">Cycle Counter Trigger</h4>
                  <p className="text-xs text-muted-foreground">
                    Automatic intervention every 2 complete Alpha-Beta cycles
                  </p>
                </Card>
                <Card className="p-4 border-red-200 bg-red-50">
                  <h4 className="font-semibold text-sm mb-2">Quality Threshold</h4>
                  <p className="text-xs text-muted-foreground">
                    Intervention triggered by low derivation quality scores
                  </p>
                </Card>
                <Card className="p-4 border-blue-200 bg-blue-50">
                  <h4 className="font-semibold text-sm mb-2">Goal Drift Detection</h4>
                  <p className="text-xs text-muted-foreground">
                    Automatic intervention when work diverges from user goals
                  </p>
                </Card>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  )
}