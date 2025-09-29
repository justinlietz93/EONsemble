import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Network, Microscope, Database, GitBranch, Target, Brain } from '@phosphor-icons/react'

export function ArchitecturalOverview() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" weight="duotone" />
            High-Level System Architecture
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="border-2 border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Microscope className="h-5 w-5 text-accent" />
                  Agent Layer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Phys-Alpha</Badge>
                    <span className="text-sm text-muted-foreground">Initiator</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Phys-Beta</Badge>
                    <span className="text-sm text-muted-foreground">Extender</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Phys-Gamma</Badge>
                    <span className="text-sm text-muted-foreground">Overseer</span>
                  </div>
                </div>
                <Separator />
                <p className="text-sm text-muted-foreground">
                  Specialized agents with defined roles and interaction protocols
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-secondary/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Database className="h-5 w-5 text-accent" />
                  Knowledge Layer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Vector Store</Badge>
                    <span className="text-sm text-muted-foreground">Semantic</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Knowledge Graph</Badge>
                    <span className="text-sm text-muted-foreground">Structured</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Context Engine</Badge>
                    <span className="text-sm text-muted-foreground">Dynamic</span>
                  </div>
                </div>
                <Separator />
                <p className="text-sm text-muted-foreground">
                  Dual-storage system for comprehensive knowledge management
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-accent/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5 text-accent" />
                  Control Layer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-accent">Orchestrator</Badge>
                    <span className="text-sm text-muted-foreground">Cycles</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-accent">Goal Monitor</Badge>
                    <span className="text-sm text-muted-foreground">Alignment</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-accent">Termination</Badge>
                    <span className="text-sm text-muted-foreground">Conditions</span>
                  </div>
                </div>
                <Separator />
                <p className="text-sm text-muted-foreground">
                  User interaction and system control mechanisms
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-primary" />
                Data Flow Architecture
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                  <Card className="text-center p-3">
                    <div className="font-medium text-sm">User Input</div>
                    <div className="text-xs text-muted-foreground mt-1">Goal + Corpus</div>
                  </Card>
                  <div className="flex justify-center">
                    <div className="w-8 h-px bg-border"></div>
                  </div>
                  <Card className="text-center p-3 bg-primary/5">
                    <div className="font-medium text-sm">Processing</div>
                    <div className="text-xs text-muted-foreground mt-1">Chunking + Embedding</div>
                  </Card>
                  <div className="flex justify-center">
                    <div className="w-8 h-px bg-border"></div>
                  </div>
                  <Card className="text-center p-3">
                    <div className="font-medium text-sm">Storage</div>
                    <div className="text-xs text-muted-foreground mt-1">Vector + Graph</div>
                  </Card>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                  <Card className="text-center p-3">
                    <div className="font-medium text-sm">Context</div>
                    <div className="text-xs text-muted-foreground mt-1">Assembly</div>
                  </Card>
                  <div className="flex justify-center">
                    <div className="w-8 h-px bg-border"></div>
                  </div>
                  <Card className="text-center p-3 bg-accent/5">
                    <div className="font-medium text-sm">Agent Cycle</div>
                    <div className="text-xs text-muted-foreground mt-1">Alpha → Beta → Gamma</div>
                  </Card>
                  <div className="flex justify-center">
                    <div className="w-8 h-px bg-border"></div>
                  </div>
                  <Card className="text-center p-3">
                    <div className="font-medium text-sm">Output</div>
                    <div className="text-xs text-muted-foreground mt-1">Derivations</div>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                Key Design Principles
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Autonomy vs. Control</h4>
                  <p className="text-sm text-muted-foreground">
                    Agents maintain specialized autonomy while Phys-Gamma provides oversight and goal alignment ensures user objective adherence.
                  </p>
                </div>
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Knowledge Representation</h4>
                  <p className="text-sm text-muted-foreground">
                    Dual storage (vector + graph) provides both semantic similarity search and structured relationship mapping.
                  </p>
                </div>
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Computational Efficiency</h4>
                  <p className="text-sm text-muted-foreground">
                    Smart context curation and cycle optimization balance derivation depth with resource management.
                  </p>
                </div>
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Scientific Rigor</h4>
                  <p className="text-sm text-muted-foreground">
                    Multi-agent validation, persistent knowledge tracking, and systematic derivation protocols ensure accuracy.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  )
}