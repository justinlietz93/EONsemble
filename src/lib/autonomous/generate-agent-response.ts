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
  console.log('Generating response for agent:', agentName)

  const collaborationContext = buildCollaborationContext(goal, derivationHistory, knowledgeBase)
  const vectorMatches = rankVectorMatches(collaborationContext.documents, collaborationContext.queryText)
  const graphInsights = deriveGraphInsights(vectorMatches, collaborationContext.documents)
  const agentKnowledge = formatAgentKnowledgeContext(collaborationContext, vectorMatches, graphInsights)

  const contextSections = buildContextSections(agentKnowledge)
  const basePrompt = buildInitialUserPrompt(goal, contextSections)
  const chatMessages = buildChatMessages(agentConfig.systemPrompt, basePrompt)
  const textPrompt = buildTextPrompt(agentConfig.systemPrompt, basePrompt)

  console.log('Calling LLM with prompt for agent:', agentName)
  const initialResponse = await callProviderLLM(agentConfig, providerConfigs, chatMessages, textPrompt)
  console.log('LLM response received, length:', initialResponse.length)

  const completed = await ensureCompletion(agentConfig, initialResponse, contextSections, agentName, providerConfigs)
  console.log('Final response length after completion handling:', completed.length)

  return normalizeCompletedResponse(completed)
}
