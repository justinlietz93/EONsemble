import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, CheckCircle, User, Eye, Calculator } from '@phosphor-icons/react'

export function TerminationMechanisms() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" weight="duotone" />
            Termination & Oversight Mechanism Design
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-lg">Termination Conditions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="border-2 border-primary/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" />
                      User-Initiated
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Badge variant="outline">Manual Stop</Badge>
                      <Badge variant="outline">Goal Modification</Badge>
                      <Badge variant="outline">Session Timeout</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      User maintains full control over derivation process termination
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-2 border-secondary/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Calculator className="h-4 w-4 text-secondary" />
                      Cycle-Based
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Badge variant="secondary">Max Cycles</Badge>
                      <Badge variant="secondary">Time Limits</Badge>
                      <Badge variant="secondary">Resource Limits</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Automatic termination based on predefined computational constraints
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-2 border-accent/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Eye className="h-4 w-4 text-accent" />
                      Gamma Decision
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Badge variant="outline" className="border-accent">Goal Achievement</Badge>
                      <Badge variant="outline" className="border-accent">Quality Threshold</Badge>
                      <Badge variant="outline" className="border-accent">Diminishing Returns</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Phys-Gamma's authoritative decision to conclude or redirect
                    </p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Cycle Monitoring Logic</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="font-mono text-sm bg-muted/50 p-4 rounded-lg">
                <div className="space-y-1">
                  <div className="text-green-600">// Cycle Monitoring Algorithm</div>
                  <div>class CycleMonitor {"{"}</div>
                  <div className="ml-2">monitor(session) {"{"}</div>
                  <div className="ml-4">// Check termination conditions</div>
                  <div className="ml-4">if (session.cycles &gt;= MAX_CYCLES) {"{"}</div>
                  <div className="ml-6">return TerminationReason.CYCLE_LIMIT</div>
                  <div className="ml-4">{"}"}</div>
                  <div></div>
                  <div className="ml-4">if (session.runtime &gt;= MAX_TIME) {"{"}</div>
                  <div className="ml-6">return TerminationReason.TIME_LIMIT</div>
                  <div className="ml-4">{"}"}</div>
                  <div></div>
                  <div className="ml-4">// Check quality convergence</div>
                  <div className="ml-4">if (detectConvergence(session.outputs)) {"{"}</div>
                  <div className="ml-6">return TerminationReason.CONVERGENCE</div>
                  <div className="ml-4">{"}"}</div>
                  <div></div>
                  <div className="ml-4">// Check goal achievement</div>
                  <div className="ml-4">alignment = assessGoalAlignment(session)</div>
                  <div className="ml-4">if (alignment &gt;= ACHIEVEMENT_THRESHOLD) {"{"}</div>
                  <div className="ml-6">return TerminationReason.GOAL_ACHIEVED</div>
                  <div className="ml-4">{"}"}</div>
                  <div></div>
                  <div className="ml-4">return ContinueDecision.PROCEED</div>
                  <div className="ml-2">{"}"}</div>
                  <div>{"}"}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Phys-Gamma Decision Framework</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Decision Criteria</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                        <span className="text-sm">Work Quality Score</span>
                        <Badge className="bg-green-600">Weight: 40%</Badge>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                        <span className="text-sm">Goal Alignment</span>
                        <Badge className="bg-blue-600">Weight: 35%</Badge>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-yellow-50 rounded">
                        <span className="text-sm">Progress Rate</span>
                        <Badge className="bg-yellow-600">Weight: 25%</Badge>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-sm mb-2">Decision Thresholds</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Continue Threshold</span>
                        <Badge variant="outline">&gt; 0.7</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Intervention Threshold</span>
                        <Badge variant="outline">0.4 - 0.7</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Termination Threshold</span>
                        <Badge variant="outline">&lt; 0.4</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quality Assessment Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-green-600" weight="fill" />
                    <div>
                      <div className="font-medium text-sm">Mathematical Rigor</div>
                      <div className="text-xs text-muted-foreground">Logical consistency and completeness</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-green-600" weight="fill" />
                    <div>
                      <div className="font-medium text-sm">Physical Validity</div>
                      <div className="text-xs text-muted-foreground">Dimensional analysis and limiting cases</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-green-600" weight="fill" />
                    <div>
                      <div className="font-medium text-sm">Derivation Completeness</div>
                      <div className="text-xs text-muted-foreground">All steps clearly justified</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-green-600" weight="fill" />
                    <div>
                      <div className="font-medium text-sm">Novel Insights</div>
                      <div className="text-xs text-muted-foreground">New understanding or connections</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Termination Scenarios</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-4 text-center text-sm font-semibold">
                  <div>Scenario</div>
                  <div>Trigger</div>
                  <div>Decision Maker</div>
                  <div>Action</div>
                </div>
                <Separator />
                
                <div className="space-y-3">
                  <div className="grid grid-cols-4 gap-4 items-center p-3 bg-green-50 rounded-lg">
                    <Badge className="justify-center bg-green-600">Goal Achieved</Badge>
                    <span className="text-sm text-center">High alignment + quality</span>
                    <span className="text-sm text-center">Phys-Gamma</span>
                    <span className="text-sm text-center">Successful termination</span>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-4 items-center p-3 bg-blue-50 rounded-lg">
                    <Badge className="justify-center bg-blue-600">User Request</Badge>
                    <span className="text-sm text-center">Manual intervention</span>
                    <span className="text-sm text-center">User</span>
                    <span className="text-sm text-center">Immediate stop</span>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-4 items-center p-3 bg-yellow-50 rounded-lg">
                    <Badge className="justify-center bg-yellow-600">Resource Limit</Badge>
                    <span className="text-sm text-center">Max cycles/time reached</span>
                    <span className="text-sm text-center">System</span>
                    <span className="text-sm text-center">Automatic termination</span>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-4 items-center p-3 bg-red-50 rounded-lg">
                    <Badge className="justify-center bg-red-600">Quality Failure</Badge>
                    <span className="text-sm text-center">Persistent low quality</span>
                    <span className="text-sm text-center">Phys-Gamma</span>
                    <span className="text-sm text-center">Intervention or stop</span>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-4 items-center p-3 bg-purple-50 rounded-lg">
                    <Badge className="justify-center bg-purple-600">Goal Drift</Badge>
                    <span className="text-sm text-center">Alignment drops below threshold</span>
                    <span className="text-sm text-center">Phys-Gamma</span>
                    <span className="text-sm text-center">Redirect or terminate</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Oversight Implementation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm">Real-time Monitoring</h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">Quality Tracking</Badge>
                      <span className="text-xs text-muted-foreground">Continuous quality assessment</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">Progress Metrics</Badge>
                      <span className="text-xs text-muted-foreground">Derivation advancement rate</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">Resource Usage</Badge>
                      <span className="text-xs text-muted-foreground">Computational cost monitoring</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">Goal Alignment</Badge>
                      <span className="text-xs text-muted-foreground">Objective adherence scoring</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-sm">Intervention Protocols</h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">Gentle Correction</Badge>
                      <span className="text-xs text-muted-foreground">Minor guidance adjustments</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">Direction Change</Badge>
                      <span className="text-xs text-muted-foreground">Redirect derivation path</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">Quality Enhancement</Badge>
                      <span className="text-xs text-muted-foreground">Improve rigor and clarity</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">Emergency Stop</Badge>
                      <span className="text-xs text-muted-foreground">Immediate termination</span>
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