import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Microscope, Brain, Eye, Lightning } from '@phosphor-icons/react'

export function AgentSpecifications() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Microscope className="h-5 w-5 text-primary" weight="duotone" />
            Agent Module Specifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="alpha" className="space-y-6">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="alpha">Phys-Alpha</TabsTrigger>
              <TabsTrigger value="beta">Phys-Beta</TabsTrigger>
              <TabsTrigger value="gamma">Phys-Gamma</TabsTrigger>
            </TabsList>

            <TabsContent value="alpha">
              <div className="space-y-6">
                <Card className="border-2 border-primary/20 bg-primary/5">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Lightning className="h-5 w-5 text-primary" />
                      Phys-Alpha: The Initiator
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-semibold text-sm mb-2">Core Role</h4>
                          <p className="text-sm text-muted-foreground">
                            Primary derivation initiator responsible for establishing foundational approaches, 
                            breaking down complex problems, and setting mathematical frameworks.
                          </p>
                        </div>
                        
                        <div>
                          <h4 className="font-semibold text-sm mb-2">Key Capabilities</h4>
                          <div className="space-y-1">
                            <Badge variant="outline">Problem Decomposition</Badge>
                            <Badge variant="outline">Mathematical Framework</Badge>
                            <Badge variant="outline">First Principles Reasoning</Badge>
                            <Badge variant="outline">Hypothesis Generation</Badge>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <h4 className="font-semibold text-sm mb-2">Behavioral Parameters</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm">Rigor Level</span>
                              <Badge variant="secondary">High</Badge>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm">Creativity</span>
                              <Badge variant="secondary">Moderate</Badge>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm">Specialization</span>
                              <Badge variant="secondary">Configurable</Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Prompt Structure</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="font-mono text-sm bg-muted/50 p-4 rounded-lg space-y-2">
                      <div className="text-green-600">## Role: Physics Derivation Initiator</div>
                      <div>You are Phys-Alpha, a specialized physics agent responsible for:</div>
                      <div>- Initiating new derivation approaches</div>
                      <div>- Establishing mathematical frameworks</div>
                      <div>- Breaking down complex problems into manageable components</div>
                      <div></div>
                      <div className="text-blue-600">## Context Package:</div>
                      <div>{'{'}{'{'}VECTOR_SEARCH_RESULTS{'}'}</div>
                      <div>{'{'}{'{'}KNOWLEDGE_GRAPH_RELATIONS{'}'}</div>
                      <div>{'{'}{'{'}GOAL_CONTRACT{'}'}</div>
                      <div>{'{'}{'{'}PREVIOUS_AGENT_OUTPUT{'}'}</div>
                      <div></div>
                      <div className="text-purple-600">## Customization Parameters:</div>
                      <div>- Domain Focus: {'{'}{'{'}DOMAIN_SPECIALIZATION{'}'}</div>
                      <div>- Approach Style: {'{'}{'{'}MATHEMATICAL_PREFERENCE{'}'}</div>
                      <div>- Rigor Level: {'{'}{'{'}VALIDATION_DEPTH{'}'}</div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Customization Options</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card className="p-4">
                        <h4 className="font-semibold text-sm mb-2">Domain Specialization</h4>
                        <div className="space-y-1">
                          <Badge variant="outline" className="text-xs">Quantum Mechanics</Badge>
                          <Badge variant="outline" className="text-xs">Classical Mechanics</Badge>
                          <Badge variant="outline" className="text-xs">Electromagnetism</Badge>
                          <Badge variant="outline" className="text-xs">Thermodynamics</Badge>
                          <Badge variant="outline" className="text-xs">General Physics</Badge>
                        </div>
                      </Card>
                      
                      <Card className="p-4">
                        <h4 className="font-semibold text-sm mb-2">Mathematical Style</h4>
                        <div className="space-y-1">
                          <Badge variant="outline" className="text-xs">Analytical</Badge>
                          <Badge variant="outline" className="text-xs">Geometric</Badge>
                          <Badge variant="outline" className="text-xs">Algebraic</Badge>
                          <Badge variant="outline" className="text-xs">Variational</Badge>
                          <Badge variant="outline" className="text-xs">Computational</Badge>
                        </div>
                      </Card>

                      <Card className="p-4">
                        <h4 className="font-semibold text-sm mb-2">Persona Options</h4>
                        <div className="space-y-1">
                          <Badge variant="outline" className="text-xs">Conservative</Badge>
                          <Badge variant="outline" className="text-xs">Innovative</Badge>
                          <Badge variant="outline" className="text-xs">Pedagogical</Badge>
                          <Badge variant="outline" className="text-xs">Research-Focused</Badge>
                        </div>
                      </Card>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="beta">
              <div className="space-y-6">
                <Card className="border-2 border-secondary/20 bg-secondary/5">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Brain className="h-5 w-5 text-secondary" />
                      Phys-Beta: The Extender
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-semibold text-sm mb-2">Core Role</h4>
                          <p className="text-sm text-muted-foreground">
                            Builds upon Alpha's work by extending derivations, exploring alternative approaches, 
                            adding mathematical rigor, and connecting to broader theoretical frameworks.
                          </p>
                        </div>
                        
                        <div>
                          <h4 className="font-semibold text-sm mb-2">Key Capabilities</h4>
                          <div className="space-y-1">
                            <Badge variant="secondary">Derivation Extension</Badge>
                            <Badge variant="secondary">Alternative Methods</Badge>
                            <Badge variant="secondary">Cross-Domain Linking</Badge>
                            <Badge variant="secondary">Mathematical Rigor</Badge>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <h4 className="font-semibold text-sm mb-2">Behavioral Parameters</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm">Building Style</span>
                              <Badge variant="outline">Incremental</Badge>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm">Exploration</span>
                              <Badge variant="outline">High</Badge>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm">Critique Level</span>
                              <Badge variant="outline">Constructive</Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Extension Strategies</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <h4 className="font-semibold text-sm">Mathematical Extensions</h4>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">Generalization</Badge>
                            <span className="text-xs text-muted-foreground">Extend to broader cases</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">Specialization</Badge>
                            <span className="text-xs text-muted-foreground">Apply to specific cases</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">Alternative Paths</Badge>
                            <span className="text-xs text-muted-foreground">Different mathematical routes</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <h4 className="font-semibold text-sm">Validation Methods</h4>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">Cross-checking</Badge>
                            <span className="text-xs text-muted-foreground">Verify Alpha's work</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">Dimensional Analysis</Badge>
                            <span className="text-xs text-muted-foreground">Unit consistency</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">Limiting Cases</Badge>
                            <span className="text-xs text-muted-foreground">Check known limits</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="gamma">
              <div className="space-y-6">
                <Card className="border-2 border-accent/20 bg-accent/5">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Eye className="h-5 w-5 text-accent" />
                      Phys-Gamma: The Overseer
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-semibold text-sm mb-2">Core Role</h4>
                          <p className="text-sm text-muted-foreground">
                            Senior oversight agent that reviews cumulative work, identifies errors, 
                            ensures goal alignment, and makes authoritative decisions about derivation quality and direction.
                          </p>
                        </div>
                        
                        <div>
                          <h4 className="font-semibold text-sm mb-2">Key Capabilities</h4>
                          <div className="space-y-1">
                            <Badge variant="outline" className="border-accent">Critical Review</Badge>
                            <Badge variant="outline" className="border-accent">Error Detection</Badge>
                            <Badge variant="outline" className="border-accent">Goal Alignment</Badge>
                            <Badge variant="outline" className="border-accent">Quality Assessment</Badge>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <h4 className="font-semibold text-sm mb-2">Authority Level</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm">Correction Power</span>
                              <Badge className="bg-accent">Authoritative</Badge>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm">Termination Rights</span>
                              <Badge className="bg-accent">Full</Badge>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm">Direction Setting</span>
                              <Badge className="bg-accent">Complete</Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Oversight Functions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card className="p-4 border-red-200 bg-red-50">
                        <h4 className="font-semibold text-sm mb-2">Error Detection</h4>
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Mathematical inconsistencies</div>
                          <div className="text-xs text-muted-foreground">Logical gaps</div>
                          <div className="text-xs text-muted-foreground">Conceptual errors</div>
                          <div className="text-xs text-muted-foreground">Invalid assumptions</div>
                        </div>
                      </Card>
                      
                      <Card className="p-4 border-blue-200 bg-blue-50">
                        <h4 className="font-semibold text-sm mb-2">Quality Assessment</h4>
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Derivation completeness</div>
                          <div className="text-xs text-muted-foreground">Mathematical rigor</div>
                          <div className="text-xs text-muted-foreground">Physical validity</div>
                          <div className="text-xs text-muted-foreground">Clarity of presentation</div>
                        </div>
                      </Card>

                      <Card className="p-4 border-green-200 bg-green-50">
                        <h4 className="font-semibold text-sm mb-2">Goal Alignment</h4>
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Objective adherence</div>
                          <div className="text-xs text-muted-foreground">Scope management</div>
                          <div className="text-xs text-muted-foreground">Progress evaluation</div>
                          <div className="text-xs text-muted-foreground">Direction correction</div>
                        </div>
                      </Card>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Decision Matrix</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center font-semibold text-sm">Quality Score</div>
                        <div className="text-center font-semibold text-sm">Goal Alignment</div>
                        <div className="text-center font-semibold text-sm">Decision</div>
                      </div>
                      <Separator />
                      <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-4 items-center">
                          <Badge className="bg-green-600 justify-center">High (&gt; 0.8)</Badge>
                          <Badge className="bg-green-600 justify-center">High (&gt; 0.8)</Badge>
                          <span className="text-sm text-center">Continue</span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 items-center">
                          <Badge className="bg-yellow-600 justify-center">Medium (0.5-0.8)</Badge>
                          <Badge className="bg-green-600 justify-center">High (&gt; 0.8)</Badge>
                          <span className="text-sm text-center">Minor Corrections</span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 items-center">
                          <Badge className="bg-red-600 justify-center">Low (&lt; 0.5)</Badge>
                          <Badge variant="outline" className="justify-center">Any</Badge>
                          <span className="text-sm text-center">Major Revision</span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 items-center">
                          <Badge variant="outline" className="justify-center">Any</Badge>
                          <Badge className="bg-red-600 justify-center">Low (&lt; 0.5)</Badge>
                          <span className="text-sm text-center">Redirect/Terminate</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}