import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Network, MagnifyingGlass, Graph, Funnel, Clock } from '@phosphor-icons/react'

export function ContextAssembly() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" weight="duotone" />
            Context Assembly Module Design
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-lg">Dynamic Context Assembly Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="p-4 text-center bg-blue-50 border-blue-200">
                    <MagnifyingGlass className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                    <div className="font-semibold text-sm">1. Vector Search</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Semantic similarity matching against knowledge base
                    </div>
                  </Card>
                  <Card className="p-4 text-center bg-green-50 border-green-200">
                    <Graph className="h-8 w-8 mx-auto mb-2 text-green-600" />
                    <div className="font-semibold text-sm">2. Graph Traversal</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Relationship-based knowledge discovery
                    </div>
                  </Card>
                  <Card className="p-4 text-center bg-yellow-50 border-yellow-200">
                    <Funnel className="h-8 w-8 mx-auto mb-2 text-yellow-600" />
                    <div className="font-semibold text-sm">3. Context Filtering</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Relevance scoring and content prioritization
                    </div>
                  </Card>
                  <Card className="p-4 text-center bg-purple-50 border-purple-200">
                    <Network className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                    <div className="font-semibold text-sm">4. Package Assembly</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Structured context delivery to agents
                    </div>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Context Components</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-primary/5 rounded-lg">
                    <div>
                      <div className="font-medium text-sm">Vector Search Results</div>
                      <div className="text-xs text-muted-foreground">Top 20 semantically similar chunks</div>
                    </div>
                    <Badge variant="outline">40%</Badge>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-secondary/5 rounded-lg">
                    <div>
                      <div className="font-medium text-sm">Knowledge Graph Relations</div>
                      <div className="text-xs text-muted-foreground">Top 10 connected entities</div>
                    </div>
                    <Badge variant="secondary">25%</Badge>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-accent/5 rounded-lg">
                    <div>
                      <div className="font-medium text-sm">Previous Agent Output</div>
                      <div className="text-xs text-muted-foreground">Complete prior work</div>
                    </div>
                    <Badge variant="outline" className="border-accent">25%</Badge>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <div>
                      <div className="font-medium text-sm">Goal Contract</div>
                      <div className="text-xs text-muted-foreground">User objectives and constraints</div>
                    </div>
                    <Badge className="bg-green-600">10%</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Assembly Logic</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="font-mono text-sm bg-muted/50 p-4 rounded-lg">
                  <div className="space-y-1">
                    <div className="text-green-600">// Context Assembly Algorithm</div>
                    <div>function assembleContext(agentTurn) {"{"}</div>
                    <div className="ml-2">// 1. Query vector store</div>
                    <div className="ml-2">vectorResults = vectorSearch(</div>
                    <div className="ml-4">query: agentTurn.intent,</div>
                    <div className="ml-4">limit: 20,</div>
                    <div className="ml-4">threshold: 0.7</div>
                    <div className="ml-2">)</div>
                    <div></div>
                    <div className="ml-2">// 2. Traverse knowledge graph</div>
                    <div className="ml-2">graphResults = traverseGraph(</div>
                    <div className="ml-4">seeds: vectorResults.entities,</div>
                    <div className="ml-4">depth: 2,</div>
                    <div className="ml-4">relationTypes: ["derives_from", "supports"]</div>
                    <div className="ml-2">)</div>
                    <div></div>
                    <div className="ml-2">// 3. Score and rank all results</div>
                    <div className="ml-2">rankedContext = scoreAndRank(</div>
                    <div className="ml-4">vectorResults + graphResults,</div>
                    <div className="ml-4">goalContract</div>
                    <div className="ml-2">)</div>
                    <div></div>
                    <div className="ml-2">return buildContextPackage(rankedContext)</div>
                    <div>{"}"}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Scoring and Ranking</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm">Relevance Factors</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Semantic Similarity</span>
                      <Badge variant="outline">30%</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Goal Alignment Score</span>
                      <Badge variant="outline">25%</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Recency Weight</span>
                      <Badge variant="outline">20%</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Agent Confidence</span>
                      <Badge variant="outline">15%</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Cross-Reference Density</span>
                      <Badge variant="outline">10%</Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-sm">Quality Filters</h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">Min Similarity</Badge>
                      <span className="text-sm text-muted-foreground">0.7 threshold</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">Duplicate Removal</Badge>
                      <span className="text-sm text-muted-foreground">Content deduplication</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">Length Filtering</Badge>
                      <span className="text-sm text-muted-foreground">Optimal chunk sizes</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">Validation Status</Badge>
                      <span className="text-sm text-muted-foreground">Verified content only</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Context Package Structure</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-mono text-sm bg-muted/50 p-4 rounded-lg">
                <div className="space-y-1">
                  <div className="text-green-600">// Context Package Schema</div>
                  <div>{"{"}</div>
                  <div className="ml-2">"session_id": string,</div>
                  <div className="ml-2">"agent_turn": {"{"}</div>
                  <div className="ml-4">"agent": "alpha" | "beta" | "gamma",</div>
                  <div className="ml-4">"cycle_number": number,</div>
                  <div className="ml-4">"turn_in_cycle": number</div>
                  <div className="ml-2">{"},"},</div>
                  <div className="ml-2">"goal_contract": GoalContract,</div>
                  <div className="ml-2">"previous_output": {"{"}</div>
                  <div className="ml-4">"agent": string,</div>
                  <div className="ml-4">"content": string,</div>
                  <div className="ml-4">"timestamp": ISO8601</div>
                  <div className="ml-2">{"},"},</div>
                  <div className="ml-2">"vector_context": [{"{"}</div>
                  <div className="ml-4">"content": string,</div>
                  <div className="ml-4">"score": number,</div>
                  <div className="ml-4">"metadata": object</div>
                  <div className="ml-2">{"}],"},</div>
                  <div className="ml-2">"graph_context": [{"{"}</div>
                  <div className="ml-4">"entity": string,</div>
                  <div className="ml-4">"relations": object[],</div>
                  <div className="ml-4">"reasoning_path": string[]</div>
                  <div className="ml-2">{"}],"},</div>
                  <div className="ml-2">"performance_metrics": {"{"}</div>
                  <div className="ml-4">"assembly_time_ms": number,</div>
                  <div className="ml-4">"total_context_tokens": number,</div>
                  <div className="ml-4">"cache_hit_ratio": number</div>
                  <div className="ml-2">{"}"}</div>
                  <div>{"}"}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-accent" />
                Performance Optimization
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 border-blue-200 bg-blue-50">
                  <h4 className="font-semibold text-sm mb-2">Caching Strategy</h4>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Vector search results cached</div>
                    <div className="text-xs text-muted-foreground">Graph traversal memoization</div>
                    <div className="text-xs text-muted-foreground">Context packages stored</div>
                  </div>
                </Card>
                
                <Card className="p-4 border-green-200 bg-green-50">
                  <h4 className="font-semibold text-sm mb-2">Parallel Processing</h4>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Concurrent vector/graph queries</div>
                    <div className="text-xs text-muted-foreground">Parallel scoring computation</div>
                    <div className="text-xs text-muted-foreground">Async package assembly</div>
                  </div>
                </Card>

                <Card className="p-4 border-yellow-200 bg-yellow-50">
                  <h4 className="font-semibold text-sm mb-2">Smart Filtering</h4>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Early similarity cutoffs</div>
                    <div className="text-xs text-muted-foreground">Incremental ranking</div>
                    <div className="text-xs text-muted-foreground">Dynamic token budgeting</div>
                  </div>
                </Card>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  )
}