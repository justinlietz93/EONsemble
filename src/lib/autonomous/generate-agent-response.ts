import type { PhysicsGoal, AgentResponse, KnowledgeEntry } from '@/App'
import type { AgentConfig, ProviderSettings } from '@/types/agent'
import type { AgentName } from '@/lib/knowledge-utils'
import {
  buildCollaborationContext,
  formatAgentKnowledgeContext,
  deriveGraphInsights,
  rankVectorMatches
} from '@/lib/knowledge-utils'

import {
  buildContextSections,
  buildInitialUserPrompt,
  buildChatMessages,
  buildTextPrompt
} from './prompt-builders'
import { callProviderLLM } from './providers'
import { ensureCompletion, normalizeCompletedResponse } from './completion'

export async function generateAgentResponse(
  agentName: AgentName,
  agentConfig: AgentConfig,
  goal: PhysicsGoal,
  derivationHistory: AgentResponse[],
  knowledgeBase: KnowledgeEntry[],
  providerConfigs?: ProviderSettings
): Promise<string> {
  const collaborationContext = buildCollaborationContext(goal, derivationHistory, knowledgeBase)
  const vectorMatches = rankVectorMatches(collaborationContext.documents, collaborationContext.queryText)
  const graphInsights = deriveGraphInsights(vectorMatches, collaborationContext.documents)
  const agentKnowledge = formatAgentKnowledgeContext(collaborationContext, vectorMatches, graphInsights)

  const contextSections = buildContextSections(agentKnowledge)
  const basePrompt = buildInitialUserPrompt(goal, contextSections)
  const chatMessages = buildChatMessages(agentConfig.systemPrompt, basePrompt)
  const textPrompt = buildTextPrompt(agentConfig.systemPrompt, basePrompt)
  const initialResponse = await callProviderLLM(agentConfig, providerConfigs, chatMessages, textPrompt)
  const completed = await ensureCompletion(agentConfig, initialResponse, contextSections, agentName, providerConfigs)
  return normalizeCompletedResponse(completed)
}
