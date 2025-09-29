import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  ClockCounterClockwise, 
  User, 
  Target, 
  Calendar, 
  MagnifyingGlass,
  Download,
  FileText
} from '@phosphor-icons/react'
import { AgentResponse, PhysicsGoal } from '@/App'
import { LaTeXRenderer } from '@/components/LaTeXRenderer'
import { hasLaTeX } from '@/lib/latex'
import { formatMarkdownSection, formatTimestamp, cleanLatexForMarkdown } from '@/lib/markdown-utils'
import { downloadJSON, downloadMarkdown } from '@/lib/download-utils'
import { toast } from 'sonner'

interface DerivationHistoryProps {
  history: AgentResponse[]
  goals: PhysicsGoal[]
}

// Agent color mapping
const AGENT_COLORS = {
  'Phys-Alpha': 'bg-blue-500',
  'Phys-Beta': 'bg-green-500',
  'Phys-Gamma': 'bg-purple-500'
} as const

export function DerivationHistory({ history, goals }: DerivationHistoryProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)

  const filteredHistory = (history || []).filter(response => {
    const matchesSearch = searchQuery === '' || 
      response.content.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesGoal = selectedGoal === null || response.goalId === selectedGoal
    const matchesAgent = selectedAgent === null || response.agent === selectedAgent
    
    return matchesSearch && matchesGoal && matchesAgent
  })

  const uniqueAgents = Array.from(new Set((history || []).map(r => r.agent)))
  const usedGoals = (goals || []).filter(goal => 
    (history || []).some(response => response.goalId === goal.id)
  )

  const getGoalTitle = (goalId: string) => {
    const goal = (goals || []).find(g => g.id === goalId)
    return goal?.title || 'Unknown Goal'
  }

  const exportHistoryJSON = () => {
    try {
      const dataToExport = filteredHistory.length < history.length ? filteredHistory : history
      
      if (dataToExport.length === 0) {
        toast.error('No data to export')
        return
      }
      
      const exportData = {
        exported_at: new Date().toISOString(),
        total_responses: dataToExport.length,
        filtered: filteredHistory.length < history.length,
        responses: dataToExport.map(response => ({
          ...response,
          goal_title: getGoalTitle(response.goalId)
        }))
      }

      const filename = `derivation-history-${new Date().toISOString().split('T')[0]}.json`
      
      console.log('Starting JSON export with data:', exportData)
      
      downloadJSON(exportData, filename)
      
      // Don't show misleading success messages - let the user see if the download actually works
      console.log(`Download triggered for: ${filename}`)
      
    } catch (error) {
      console.error('Export failed:', error)
      toast.error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const exportHistoryMarkdown = () => {
    try {
      const dataToExport = filteredHistory.length < history.length ? filteredHistory : history
      
      if (dataToExport.length === 0) {
        toast.error('No data to export')
        return
      }
      
      const now = new Date()
      let markdown = formatMarkdownSection('Derivation Progress Report', '', 1)
      markdown += `**Generated:** ${formatTimestamp(now.toISOString())}\n`
      markdown += `**Total Responses:** ${dataToExport.length}\n`
      if (filteredHistory.length < history.length) {
        markdown += `**Filtered View:** Yes (showing ${dataToExport.length} of ${history.length} total)\n`
      }
      
      // Calculate groupedByGoal for the export
      const exportGroupedByGoal = dataToExport.reduce((acc, response) => {
        const goalId = response.goalId
        if (!acc[goalId]) {
          acc[goalId] = []
        }
        acc[goalId].push(response)
        return acc
      }, {} as Record<string, AgentResponse[]>)
      
      markdown += `**Goals Covered:** ${Object.keys(exportGroupedByGoal).length}\n\n`

      Object.entries(exportGroupedByGoal).forEach(([goalId, responses]) => {
        const goal = goals.find(g => g.id === goalId)
        markdown += formatMarkdownSection(goal?.title || 'Unknown Goal', '', 2)
        
        if (goal) {
          markdown += `**Domain:** ${goal.domain}\n`
          markdown += `**Description:** ${goal.description}\n`
          markdown += `**Objectives:**\n`
          goal.objectives.forEach(obj => {
            markdown += `- ${obj}\n`
          })
          markdown += `\n**Constraints:**\n`
          goal.constraints.forEach(constraint => {
            markdown += `- ${constraint}\n`
          })
          markdown += `\n`
        }

        markdown += `**Total Responses:** ${responses.length}\n`
        markdown += `**Cycles Completed:** ${Math.max(...responses.map(r => r.cycle))}\n\n`

        // Sort responses chronologically
        const sortedResponses = responses.sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        )

        sortedResponses.forEach((response, index) => {
          markdown += formatMarkdownSection(`${response.agent} - Cycle ${response.cycle}`, '', 3)
          markdown += `**Timestamp:** ${formatTimestamp(response.timestamp)}\n\n`
          
          // Clean LaTeX for markdown
          const cleanedContent = cleanLatexForMarkdown(response.content)
          markdown += `${cleanedContent}\n\n`
          
          if (index < sortedResponses.length - 1) {
            markdown += `---\n\n`
          }
        })
        
        markdown += `\n\n`
      })

      const filename = `derivation-progress-${new Date().toISOString().split('T')[0]}.md`
      
      console.log('Starting Markdown export, content length:', markdown.length)
      
      downloadMarkdown(markdown, filename)
      
      // Don't show misleading success messages - let the user see if the download actually works
      console.log(`Download triggered for: ${filename}`)
      
    } catch (error) {
      console.error('Export failed:', error)
      toast.error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const groupedByGoal = filteredHistory.reduce((acc, response) => {
    const goalId = response.goalId
    if (!acc[goalId]) {
      acc[goalId] = []
    }
    acc[goalId].push(response)
    return acc
  }, {} as Record<string, AgentResponse[]>)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Derivation History</h2>
          <p className="text-muted-foreground">
            {(history || []).length} total responses across {Object.keys(groupedByGoal).length} goals
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={exportHistoryMarkdown}
            disabled={(history || []).length === 0}
            className="flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            Download Markdown
          </Button>
          <Button 
            variant="outline" 
            onClick={exportHistoryJSON}
            disabled={(history || []).length === 0}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export JSON
          </Button>
        </div>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MagnifyingGlass className="h-5 w-5" />
            Search & Filter History
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="search-content">Search Content</Label>
            <Input
              id="search-content"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search derivation content..."
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Filter by Goal</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                <Button
                  variant={selectedGoal === null ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedGoal(null)}
                >
                  All Goals
                </Button>
                {usedGoals.map(goal => (
                  <Button
                    key={goal.id}
                    variant={selectedGoal === goal.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedGoal(goal.id)}
                    className="flex items-center gap-1"
                  >
                    <Target className="h-3 w-3" />
                    {goal.title}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label>Filter by Agent</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                <Button
                  variant={selectedAgent === null ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedAgent(null)}
                >
                  All Agents
                </Button>
                {uniqueAgents.map(agent => (
                  <Button
                    key={agent}
                    variant={selectedAgent === agent ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedAgent(agent)}
                    className="flex items-center gap-1"
                  >
                    <User className="h-3 w-3" />
                    {agent}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* History Content */}
      <div className="space-y-6">
        {Object.keys(groupedByGoal).length > 0 ? (
          Object.entries(groupedByGoal).map(([goalId, responses]) => (
            <Card key={goalId}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  {getGoalTitle(goalId)}
                </CardTitle>
                <p className="text-muted-foreground">
                  {responses.length} responses • 
                  {Math.max(...responses.map(r => r.cycle))} cycles completed
                </p>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-96">
                  <div className="space-y-4">
                    {responses
                      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                      .map((response, index) => (
                        <div key={response.id}>
                          <div className="flex items-start gap-4">
                            <div className="flex-shrink-0">
                              <Badge className={AGENT_COLORS[response.agent]}>
                                {response.agent}
                              </Badge>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm font-medium">
                                  Cycle {response.cycle}
                                </span>
                                <span className="text-sm text-muted-foreground flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {new Date(response.timestamp).toLocaleString()}
                                </span>
                              </div>
                              <div className="bg-muted rounded p-3">
                                {hasLaTeX(response.content) ? (
                                  <LaTeXRenderer content={response.content} className="text-sm" />
                                ) : (
                                  <pre className="text-sm whitespace-pre-wrap font-mono">
                                    {response.content}
                                  </pre>
                                )}
                              </div>
                            </div>
                          </div>
                          {index < responses.length - 1 && (
                            <Separator className="my-4" />
                          )}
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <ClockCounterClockwise className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {(history || []).length === 0 ? 'No Derivation History' : 'No Matching History'}
              </h3>
              <p className="text-muted-foreground">
                {(history || []).length === 0 
                  ? 'Start agent collaboration to see derivation history here'
                  : 'Try adjusting your search or filter criteria'
                }
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}