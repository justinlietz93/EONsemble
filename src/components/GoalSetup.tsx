import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Plus, Target, Play, Trash } from '@phosphor-icons/react'
import { PhysicsGoal } from '@/App'

interface GoalSetupProps {
  goals: PhysicsGoal[]
  setGoals: (goals: PhysicsGoal[]) => void
  activeGoal: string | null
  setActiveGoal: (goalId: string | null) => void
  onGoalActivated: () => void
}

export function GoalSetup({ goals, setGoals, activeGoal, setActiveGoal, onGoalActivated }: GoalSetupProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [newGoal, setNewGoal] = useState({
    title: '',
    description: '',
    domain: '',
    objectives: [''],
    constraints: ['']
  })

  const handleCreateGoal = () => {
    const goal: PhysicsGoal = {
      id: `goal-${Date.now()}`,
      title: newGoal.title,
      description: newGoal.description,
      domain: newGoal.domain,
      objectives: newGoal.objectives.filter(obj => obj.trim()),
      constraints: newGoal.constraints.filter(con => con.trim()),
      createdAt: new Date().toISOString()
    }

    setGoals([...goals, goal])
    setNewGoal({
      title: '',
      description: '',
      domain: '',
      objectives: [''],
      constraints: ['']
    })
    setIsCreating(false)
  }

  const handleActivateGoal = (goalId: string) => {
    setActiveGoal(goalId)
    onGoalActivated()
  }

  const handleDeleteGoal = (goalId: string) => {
    setGoals(goals.filter(g => g.id !== goalId))
    if (activeGoal === goalId) {
      setActiveGoal(null)
    }
  }

  const addObjective = () => {
    setNewGoal(prev => ({
      ...prev,
      objectives: [...prev.objectives, '']
    }))
  }

  const addConstraint = () => {
    setNewGoal(prev => ({
      ...prev,
      constraints: [...prev.constraints, '']
    }))
  }

  const updateObjective = (index: number, value: string) => {
    setNewGoal(prev => ({
      ...prev,
      objectives: prev.objectives.map((obj, i) => i === index ? value : obj)
    }))
  }

  const updateConstraint = (index: number, value: string) => {
    setNewGoal(prev => ({
      ...prev,
      constraints: prev.constraints.map((con, i) => i === index ? value : con)
    }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Physics Research Goals</h2>
          <p className="text-muted-foreground">Define objectives for agent collaboration</p>
        </div>
        <Button onClick={() => setIsCreating(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New Goal
        </Button>
      </div>

      {isCreating && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Create New Research Goal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={newGoal.title}
                onChange={(e) => setNewGoal(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Quantum Field Theory Derivation"
              />
            </div>

            <div>
              <Label htmlFor="domain">Physics Domain</Label>
              <Input
                id="domain"
                value={newGoal.domain}
                onChange={(e) => setNewGoal(prev => ({ ...prev, domain: e.target.value }))}
                placeholder="e.g., Quantum Mechanics, Thermodynamics, Relativity"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newGoal.description}
                onChange={(e) => setNewGoal(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Detailed description of what you want to derive or explore..."
                rows={3}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Research Objectives</Label>
                <Button variant="outline" size="sm" onClick={addObjective}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              {newGoal.objectives.map((objective, index) => (
                <Input
                  key={index}
                  value={objective}
                  onChange={(e) => updateObjective(index, e.target.value)}
                  placeholder="e.g., Derive the Schrödinger equation from first principles"
                  className="mb-2"
                />
              ))}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Constraints & Requirements</Label>
                <Button variant="outline" size="sm" onClick={addConstraint}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              {newGoal.constraints.map((constraint, index) => (
                <Input
                  key={index}
                  value={constraint}
                  onChange={(e) => updateConstraint(index, e.target.value)}
                  placeholder="e.g., Use canonical quantization approach"
                  className="mb-2"
                />
              ))}
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={handleCreateGoal} disabled={!newGoal.title || !newGoal.description}>
                Create Goal
              </Button>
              <Button variant="outline" onClick={() => setIsCreating(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {goals.map(goal => (
          <Card key={goal.id} className={activeGoal === goal.id ? 'ring-2 ring-primary' : ''}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {goal.title}
                    {activeGoal === goal.id && (
                      <Badge variant="default" className="bg-accent text-accent-foreground">
                        Active
                      </Badge>
                    )}
                  </CardTitle>
                  <p className="text-muted-foreground text-sm mt-1">{goal.domain}</p>
                </div>
                <div className="flex gap-2">
                  {activeGoal !== goal.id && (
                    <Button 
                      size="sm" 
                      onClick={() => handleActivateGoal(goal.id)}
                      className="flex items-center gap-1"
                    >
                      <Play className="h-3 w-3" />
                      Activate
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleDeleteGoal(goal.id)}
                  >
                    <Trash className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm mb-3">{goal.description}</p>
              
              {goal.objectives.length > 0 && (
                <div className="mb-3">
                  <p className="text-sm font-medium mb-2">Objectives:</p>
                  <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                    {goal.objectives.map((obj, index) => (
                      <li key={index}>{obj}</li>
                    ))}
                  </ul>
                </div>
              )}

              {goal.constraints.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Constraints:</p>
                  <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                    {goal.constraints.map((con, index) => (
                      <li key={index}>{con}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {goals.length === 0 && !isCreating && (
          <Card>
            <CardContent className="text-center py-12">
              <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Research Goals</h3>
              <p className="text-muted-foreground mb-4">
                Create your first physics research goal to start agent collaboration
              </p>
              <Button onClick={() => setIsCreating(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Goal
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}