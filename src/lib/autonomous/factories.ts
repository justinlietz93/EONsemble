import type { AgentResponse, KnowledgeEntry } from '@/App'
import type { AgentName } from '@/lib/knowledge-utils'
import { buildConceptTags } from '@/lib/knowledge-utils'

export function createAgentResponse(
  agentName: AgentName,
  content: string,
  cycle: number,
  goalId: string
): AgentResponse {
  return {
    id: `response-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    agent: agentName,
    content,
    timestamp: new Date().toISOString(),
    cycle,
    goalId
  }
}

export function createKnowledgeEntry(
  agentName: AgentName,
  content: string,
  cycle: number,
  goalTitle: string,
  domain: string
): KnowledgeEntry {
  const baseTags = [domain, agentName.toLowerCase(), 'derivation']
  return {
    id: `knowledge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: `${agentName} - Cycle ${cycle}`,
    content,
    source: `Agent Collaboration - ${goalTitle}`,
    tags: buildConceptTags(content, baseTags),
    timestamp: new Date().toISOString()
  }
}
