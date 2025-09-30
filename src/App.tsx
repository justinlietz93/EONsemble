import { useCallback, useEffect, useRef } from 'react'
import { useKV } from '@/hooks/useKV'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Network, Target, Play, ClockCounterClockwise, Gear } from '@phosphor-icons/react'
import { GoalSetup } from '@/components/GoalSetup'
import { AgentCollaboration } from '@/components/AgentCollaboration'
import { KnowledgeBase } from '@/components/KnowledgeBase'
import { DerivationHistory } from '@/components/DerivationHistory'
import { AgentSettings } from '@/components/AgentSettings'
import { useVoidMemoryBridge } from '@/hooks/useVoidMemoryBridge'
import { useSessionDiagnostics } from '@/hooks/useSessionDiagnostics'

const SESSION_TAB_KEY = 'eon.activeTab'

const resolveInitialActiveTab = (): string => {
  if (typeof window === 'undefined') {
    return 'goal-setup'
  }

  const sessionValue = window.sessionStorage?.getItem(SESSION_TAB_KEY)
  if (sessionValue && sessionValue.trim().length > 0) {
    return sessionValue
  }

  return 'goal-setup'
}

export interface PhysicsGoal {
  id: string
  title: string
  description: string
  domain: string
  objectives: string[]
  constraints: string[]
  createdAt: string
}

export interface AgentResponse {
  id: string
  agent: 'Phys-Alpha' | 'Phys-Beta' | 'Phys-Gamma'
  content: string
  timestamp: string
  cycle: number
  goalId: string
}

export interface KnowledgeEntry {
  id: string
  title: string
  content: string
  source: string
  tags: string[]
  timestamp: string
}

function App() {
  const [activeTab, setActiveTab] = useKV<string>('active-tab', resolveInitialActiveTab)
  const [goals, setGoals] = useKV<PhysicsGoal[]>('physics-goals', [])
  const [activeGoal, setActiveGoal] = useKV<string | null>('active-goal', null)
  const [derivationHistory, setDerivationHistory] = useKV<AgentResponse[]>('derivation-history', [])
  const [knowledgeBase, setKnowledgeBase] = useKV<KnowledgeEntry[]>('knowledge-base', [])

  const currentGoal = goals?.find(g => g.id === activeGoal)
  const hasActiveGoal = Boolean(currentGoal)

  const lastNonLaunchTabRef = useRef<string>('goal-setup')
  const goalTabAllowanceRef = useRef(false)
  const tabChangeReasonRef = useRef<'initial-load' | 'user-selection' | 'auto-restore' | 'persistence-reset'>('initial-load')
  const lastDetectedResetRef = useRef<'none' | 'persistence-reset' | 'restored'>('none')
  const pendingTabChangeReasonRef = useRef<'user-selection' | 'auto-restore' | null>(null)
  const previousActiveTabRef = useRef<string>(activeTab)

  const handleActiveTabChange = useCallback(
    (nextTab: string) => {
      if (nextTab === 'goal-setup') {
        goalTabAllowanceRef.current = true
      } else {
        lastNonLaunchTabRef.current = nextTab
        goalTabAllowanceRef.current = false
      }
      tabChangeReasonRef.current = 'user-selection'
      pendingTabChangeReasonRef.current = 'user-selection'
      setActiveTab(nextTab)
    },
    [setActiveTab]
  )

  useEffect(() => {
    if (pendingTabChangeReasonRef.current) {
      tabChangeReasonRef.current = pendingTabChangeReasonRef.current
      pendingTabChangeReasonRef.current = null
    } else if (previousActiveTabRef.current !== activeTab && activeTab === 'goal-setup') {
      tabChangeReasonRef.current = 'persistence-reset'
    }

    previousActiveTabRef.current = activeTab
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== 'goal-setup') {
      if (lastDetectedResetRef.current === 'persistence-reset') {
        lastDetectedResetRef.current = 'restored'
      } else if (lastDetectedResetRef.current === 'restored') {
        lastDetectedResetRef.current = 'none'
      } else {
        lastDetectedResetRef.current = 'none'
      }
      lastNonLaunchTabRef.current = activeTab
      goalTabAllowanceRef.current = false
      return
    }

    if (goalTabAllowanceRef.current) {
      goalTabAllowanceRef.current = false
      return
    }

    lastDetectedResetRef.current = 'persistence-reset'
    const fallbackTab = lastNonLaunchTabRef.current
    if (fallbackTab && fallbackTab !== 'goal-setup') {
      console.warn(`Restoring active tab to ${fallbackTab} after unexpected reset`)
      goalTabAllowanceRef.current = true
      tabChangeReasonRef.current = 'auto-restore'
      pendingTabChangeReasonRef.current = 'auto-restore'
      setActiveTab(fallbackTab)
      return
    }

    tabChangeReasonRef.current = 'persistence-reset'
  }, [activeTab, setActiveTab])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    try {
      window.sessionStorage.setItem(SESSION_TAB_KEY, activeTab)
    } catch (error) {
      console.warn('Failed to persist active tab to sessionStorage', error)
    }
  }, [activeTab])

  useVoidMemoryBridge(currentGoal, derivationHistory || [], knowledgeBase || [])
  const unexpectedReset = activeTab === 'goal-setup' && !goalTabAllowanceRef.current
  const derivedTabChangeReason = unexpectedReset
    ? 'persistence-reset'
    : tabChangeReasonRef.current
  const derivedLastDetectedReset = unexpectedReset
    ? 'persistence-reset'
    : lastDetectedResetRef.current

  useSessionDiagnostics(activeTab, {
    activeGoalId: activeGoal || null,
    knowledgeEntryCount: knowledgeBase?.length ?? 0,
    knowledgeSample: (knowledgeBase || []).slice(0, 5).map((entry) => ({
      id: entry.id,
      title: entry.title,
    })),
  }, {
    tabChangeReason: derivedTabChangeReason,
    lastDetectedReset: derivedLastDetectedReset,
  })

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Network className="h-8 w-8 text-primary" weight="duotone" />
              <h1 className="text-2xl font-bold text-foreground">
                Collaborative Physicist Agent System
              </h1>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {hasActiveGoal && (
                <Badge variant="default" className="bg-accent text-accent-foreground">
                  Active: {currentGoal?.title}
                </Badge>
              )}
              <Badge variant="secondary">
                {knowledgeBase?.length || 0} Knowledge Entries
              </Badge>
            </div>
          </div>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            AI agents collaborating to solve complex physics problems with persistent knowledge management
          </p>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={handleActiveTabChange} className="space-y-6">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="goal-setup" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Goal Setup
            </TabsTrigger>
            <TabsTrigger value="collaboration" className="flex items-center gap-2" disabled={!hasActiveGoal}>
              <Play className="h-4 w-4" />
              Agent Collaboration
            </TabsTrigger>
            <TabsTrigger value="knowledge" className="flex items-center gap-2">
              <Network className="h-4 w-4" />
              Knowledge Base
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <ClockCounterClockwise className="h-4 w-4" />
              Derivation History
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Gear className="h-4 w-4" />
              Agent Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="goal-setup">
            <GoalSetup
              goals={goals || []}
              setGoals={setGoals}
              activeGoal={activeGoal || null}
              setActiveGoal={setActiveGoal}
              onGoalActivated={() => handleActiveTabChange('collaboration')}
            />
          </TabsContent>

          <TabsContent value="collaboration">
            <AgentCollaboration
              goal={currentGoal}
              derivationHistory={derivationHistory || []}
              setDerivationHistory={setDerivationHistory}
              knowledgeBase={knowledgeBase || []}
              setKnowledgeBase={setKnowledgeBase}
            />
          </TabsContent>

          <TabsContent value="knowledge">
            <KnowledgeBase 
              knowledgeBase={knowledgeBase || []}
              setKnowledgeBase={setKnowledgeBase}
              derivationHistory={derivationHistory || []}
              goals={goals || []}
            />
          </TabsContent>

          <TabsContent value="history">
            <DerivationHistory 
              history={derivationHistory || []}
              goals={goals || []}
            />
          </TabsContent>

          <TabsContent value="settings">
            <AgentSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default App