import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Database, Network, MagnifyingGlass, Graph, Lightning, ArrowsClockwise } from '@phosphor-icons/react'

export function KnowledgeManagement() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" weight="duotone" />
            Knowledge Management Design
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="vector">Vector Store</TabsTrigger>
              <TabsTrigger value="graph">Knowledge Graph</TabsTrigger>
              <TabsTrigger value="ingestion">Data Ingestion</TabsTrigger>
              <TabsTrigger value="retrieval">Retrieval</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="space-y-6">
                <Card className="bg-muted/30">
                  <CardHeader>
                    <CardTitle className="text-lg">Dual-Storage Architecture</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <Card className="border-2 border-primary/20">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <MagnifyingGlass className="h-4 w-4 text-primary" />
                            Vector Store
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="space-y-2">
                            <Badge variant="outline">Semantic Search</Badge>
                            <Badge variant="outline">Dense Embeddings</Badge>
                            <Badge variant="outline">Similarity Matching</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Enables finding conceptually similar content regardless of exact terminology
                          </p>
                        </CardContent>
                      </Card>

                      <Card className="border-2 border-secondary/20">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Graph className="h-4 w-4 text-secondary" />
                            Knowledge Graph
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="space-y-2">
                            <Badge variant="secondary">Structured Relations</Badge>
                            <Badge variant="secondary">Logical Inference</Badge>
                            <Badge variant="secondary">Entity Linking</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Captures explicit relationships and enables reasoning over connected concepts
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <ArrowsClockwise className="h-5 w-5 text-accent" />
                      Synchronization Strategy
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="p-4 text-center">
                          <Lightning className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                          <h4 className="font-semibold text-sm">Real-time Sync</h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            Every agent interaction immediately updates both stores
                          </p>
                        </Card>
                        <Card className="p-4 text-center">
                          <Database className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                          <h4 className="font-semibold text-sm">Consistency Check</h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            Periodic validation ensures data integrity across stores
                          </p>
                        </Card>
                        <Card className="p-4 text-center">
                          <Network className="h-8 w-8 mx-auto mb-2 text-green-500" />
                          <h4 className="font-semibold text-sm">Conflict Resolution</h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            Automated resolution with human oversight for conflicts
                          </p>
                        </Card>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="vector">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Vector Store Schema</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="font-mono text-sm bg-muted/50 p-4 rounded-lg">
                      <div className="space-y-1">
                        <div className="text-green-600">// Document Schema</div>
                        <div>{"{"}</div>
                        <div className="ml-4">id: string,</div>
                        <div className="ml-4">content: string,</div>
                        <div className="ml-4">embedding: number[1536],</div>
                        <div className="ml-4">metadata: {"{"}</div>
                        <div className="ml-8">type: "corpus" | "derivation" | "critique",</div>
                        <div className="ml-8">agent: "alpha" | "beta" | "gamma" | "user",</div>
                        <div className="ml-8">timestamp: ISO8601,</div>
                        <div className="ml-8">cycle_id: string,</div>
                        <div className="ml-8">goal_alignment_score: number,</div>
                        <div className="ml-8">physics_domain: string[],</div>
                        <div className="ml-8">equations: string[],</div>
                        <div className="ml-8">references: string[]</div>
                        <div className="ml-4">{"}"}</div>
                        <div>{"}"}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Embedding Strategy</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <h4 className="font-semibold text-sm">Model Selection</h4>
                        <div className="space-y-2">
                          <Badge variant="outline">text-embedding-3-large</Badge>
                          <p className="text-xs text-muted-foreground">
                            1536 dimensions, optimized for scientific content
                          </p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <h4 className="font-semibold text-sm">Chunking Strategy</h4>
                        <div className="space-y-2">
                          <Badge variant="outline">Semantic Chunking</Badge>
                          <p className="text-xs text-muted-foreground">
                            Variable size based on content structure and equations
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="graph">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Knowledge Graph Ontology</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <Card className="p-4">
                          <h4 className="font-semibold text-sm mb-3">Entity Types</h4>
                          <div className="space-y-2">
                            <Badge variant="outline">Concept</Badge>
                            <Badge variant="outline">Equation</Badge>
                            <Badge variant="outline">Variable</Badge>
                            <Badge variant="outline">Principle</Badge>
                            <Badge variant="outline">Derivation</Badge>
                            <Badge variant="outline">Reference</Badge>
                          </div>
                        </Card>
                        
                        <Card className="p-4">
                          <h4 className="font-semibold text-sm mb-3">Relationship Types</h4>
                          <div className="space-y-2">
                            <Badge variant="secondary">derives_from</Badge>
                            <Badge variant="secondary">applies_to</Badge>
                            <Badge variant="secondary">contradicts</Badge>
                            <Badge variant="secondary">supports</Badge>
                            <Badge variant="secondary">generalizes</Badge>
                            <Badge variant="secondary">specializes</Badge>
                          </div>
                        </Card>

                        <Card className="p-4">
                          <h4 className="font-semibold text-sm mb-3">Properties</h4>
                          <div className="space-y-2">
                            <Badge variant="outline">confidence_score</Badge>
                            <Badge variant="outline">validation_status</Badge>
                            <Badge variant="outline">complexity_level</Badge>
                            <Badge variant="outline">domain_tags</Badge>
                          </div>
                        </Card>
                      </div>

                      <Card className="bg-muted/30">
                        <CardHeader>
                          <CardTitle className="text-base">Example Graph Structure</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="font-mono text-sm bg-background p-4 rounded">
                            <div className="space-y-1">
                              <div>(Maxwell_Equations) -[derives_from]→ (Electromagnetic_Theory)</div>
                              <div>(Faraday_Law) -[component_of]→ (Maxwell_Equations)</div>
                              <div>(∇×E = -∂B/∂t) -[mathematical_form]→ (Faraday_Law)</div>
                              <div>(Electric_Field) -[appears_in]→ (∇×E = -∂B/∂t)</div>
                              <div>(Magnetic_Field) -[appears_in]→ (∇×E = -∂B/∂t)</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="ingestion">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Data Ingestion Pipeline</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card className="p-4 text-center bg-blue-50 border-blue-200">
                          <div className="font-semibold text-sm">1. Parse</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            LaTeX, PDF, Markdown parsing with equation extraction
                          </div>
                        </Card>
                        <Card className="p-4 text-center bg-green-50 border-green-200">
                          <div className="font-semibold text-sm">2. Chunk</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Semantic chunking preserving equation context
                          </div>
                        </Card>
                        <Card className="p-4 text-center bg-yellow-50 border-yellow-200">
                          <div className="font-semibold text-sm">3. Embed</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Generate dense vector representations
                          </div>
                        </Card>
                        <Card className="p-4 text-center bg-purple-50 border-purple-200">
                          <div className="font-semibold text-sm">4. Store</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Dual storage with relationship extraction
                          </div>
                        </Card>
                      </div>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Processing Rules</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">Equation Preservation</Badge>
                              <span className="text-sm text-muted-foreground">Never split equations across chunks</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">Context Maintenance</Badge>
                              <span className="text-sm text-muted-foreground">Include surrounding derivation context</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">Metadata Enrichment</Badge>
                              <span className="text-sm text-muted-foreground">Automatic domain and complexity tagging</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="retrieval">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Retrieval Logic</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <Card className="bg-muted/30">
                        <CardHeader>
                          <CardTitle className="text-base">Hybrid Search Strategy</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                              <h4 className="font-semibold text-sm">Vector Search (70%)</h4>
                              <div className="space-y-2">
                                <p className="text-sm text-muted-foreground">
                                  Semantic similarity search for conceptually related content
                                </p>
                                <div className="font-mono text-xs bg-background p-2 rounded">
                                  cosine_similarity(query_embedding, doc_embedding) &gt; 0.7
                                </div>
                              </div>
                            </div>
                            <div className="space-y-3">
                              <h4 className="font-semibold text-sm">Graph Traversal (30%)</h4>
                              <div className="space-y-2">
                                <p className="text-sm text-muted-foreground">
                                  Relationship-based discovery of connected concepts
                                </p>
                                <div className="font-mono text-xs bg-background p-2 rounded">
                                  MATCH (n)-[r*1..3]-(m) WHERE n.id IN vector_results
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Ranking Factors</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-sm">Semantic Similarity</span>
                                <Badge variant="outline">40%</Badge>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm">Goal Alignment</span>
                                <Badge variant="outline">25%</Badge>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm">Recency</span>
                                <Badge variant="outline">20%</Badge>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm">Agent Confidence</span>
                                <Badge variant="outline">15%</Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Context Limits</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-sm">Vector Results</span>
                                <Badge variant="secondary">Top 20</Badge>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm">Graph Results</span>
                                <Badge variant="secondary">Top 10</Badge>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm">Total Token Limit</span>
                                <Badge variant="secondary">8,000</Badge>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm">Goal Contract</span>
                                <Badge variant="secondary">Always Include</Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
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