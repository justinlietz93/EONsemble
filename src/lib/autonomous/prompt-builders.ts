import type { PhysicsGoal } from '@/App'
import type { AgentKnowledgeContext } from '@/lib/knowledge-utils'

import { COMPLETION_MARKER } from './constants'
import { sparkRuntime } from './spark-runtime'

export interface ContextSections {
  collaboration: string
  vector: string
  graph: string
  focus: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export function buildContextSections(agentKnowledge: AgentKnowledgeContext): ContextSections {
  const collaboration = agentKnowledge.collaborationDigest

  const vector =
    agentKnowledge.vectorHighlights.length > 0
      ? agentKnowledge.vectorHighlights.map((entry, index) => `${index + 1}. ${entry}`).join('\n\n')
      : 'No high-similarity entries retrieved from the vector store. Focus on deriving fresh insights while keeping goal alignment.'

  const graph =
    agentKnowledge.knowledgeGraphInsights.length > 0
      ? agentKnowledge.knowledgeGraphInsights.join('\n\n')
      : 'Knowledge graph reveals no strong relational context yet. Explicitly articulate new linkages you establish.'

  const focusItems = agentKnowledge.collaborationFocus
  const focus =
    focusItems.length > 0
      ? focusItems.map((entry, index) => `${index + 1}. ${entry}`).join('\n')
      : 'No unresolved action items detected. Continue advancing the shared derivation meaningfully.'

  return { collaboration, vector, graph, focus }
}

export function buildInitialUserPrompt(goal: PhysicsGoal, contextSections: ContextSections): string {
  const objectives = goal.objectives?.length ? goal.objectives.join(', ') : 'None provided'
  const constraints = goal.constraints?.length ? goal.constraints.join(', ') : 'None provided'

  return [
    '<GoalContract>',
    `Research Goal: ${goal.title}`,
    `Domain: ${goal.domain}`,
    `Description: ${goal.description}`,
    `Objectives: ${objectives}`,
    `Constraints: ${constraints}`,
    '</GoalContract>',
    '',
    '<CollaborationDigest>',
    contextSections.collaboration,
    '</CollaborationDigest>',
    '',
    '<VectorStoreContext>',
    contextSections.vector,
    '</VectorStoreContext>',
    '',
    '<KnowledgeGraphContext>',
    contextSections.graph,
    '</KnowledgeGraphContext>',
    '',
    '<CollaborationFocus>',
    contextSections.focus,
    '</CollaborationFocus>',
    '',
    'TASK: Provide a complete contribution to this physics derivation that explicitly builds upon the collaboration history and integrates relevant knowledge.',
    '',
    'RESPONSE REQUIREMENTS:',
    '1. Reference the specific prior agent work or knowledge entries that you build upon.',
    '2. Maintain rigorous mathematical derivations with all steps shown, using LaTeX (\\[ \\] for block, \\( \\) for inline).',
    '3. Provide clear physical explanations accompanying each derivation segment.',
    '4. Address gaps, TODOs, or open questions implied by the collaboration digest.',
    '5. Resolve relevant collaboration focus items or describe how you progressed them.',
    `6. End your response with the exact marker ${COMPLETION_MARKER} on its own line.`,
    '7. Ensure the narrative is continuous and never terminates mid-sentence, mid-equation, or mid-thought.',
    '',
    'Begin your contribution now.'
  ].join('\n')
}

export function buildContinuationUserPrompt(
  missingMarker: boolean,
  priorResponse: string,
  contextSections: ContextSections
): string {
  const markerInstruction = missingMarker
    ? `did not conclude with the required marker ${COMPLETION_MARKER}.`
    : 'appears to have stopped mid-thought even though the marker was emitted.'

  return [
    `The previous output ${markerInstruction} Continue seamlessly from where it stopped, ensuring all partial sentences, equations, and code fences are finished cleanly.`,
    '',
    '<PriorOutput>',
    priorResponse,
    '</PriorOutput>',
    '',
    '<CollaborationDigest>',
    contextSections.collaboration,
    '</CollaborationDigest>',
    '',
    '<VectorStoreContext>',
    contextSections.vector,
    '</VectorStoreContext>',
    '',
    '<KnowledgeGraphContext>',
    contextSections.graph,
    '</KnowledgeGraphContext>',
    '',
    '<CollaborationFocus>',
    contextSections.focus,
    '</CollaborationFocus>',
    '',
    'REQUIREMENTS:',
    '- Resume exactly where the prior text halted, finishing incomplete sentences or equations first.',
    '- Do not restate sections that are already complete.',
    '- Add any missing conclusions or summaries to provide closure.',
    `- Address any relevant outstanding focus items before concluding.`,
    `- End with the marker ${COMPLETION_MARKER} on its own line.`,
    '- Double-check that all LaTeX environments, parentheses, and code fences are balanced before finishing.'
  ].join('\n')
}

export function buildChatMessages(systemPrompt: string, userPrompt: string): ChatMessage[] {
  const messages: ChatMessage[] = []
  const trimmedSystem = systemPrompt?.trim()
  if (trimmedSystem) {
    messages.push({ role: 'system', content: trimmedSystem })
  }
  messages.push({ role: 'user', content: userPrompt })
  return messages
}

export function buildTextPrompt(systemPrompt: string, userPrompt: string): string {
  const trimmedSystem = systemPrompt?.trim()
  if (!trimmedSystem) {
    return userPrompt
  }

  if (sparkRuntime?.llmPrompt) {
    return sparkRuntime.llmPrompt`
      ${trimmedSystem}

      ${userPrompt}
    `
  }

  return `${trimmedSystem}\n\n${userPrompt}`
}
