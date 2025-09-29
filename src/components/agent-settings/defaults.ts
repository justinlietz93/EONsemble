import type { AgentConfig, ProviderSettings, LLMProvider } from '@/types/agent'
import { DEFAULT_PROVIDER_SETTINGS } from '@/types/agent'
import type { AutonomousConfig } from '@/types/autonomous'
import { DEFAULT_AUTONOMOUS_CONFIG } from '@/types/autonomous'

export const DEFAULT_AGENT_CONFIGS: AgentConfig[] = [
  {
    id: 'phys-alpha',
    name: 'Phys-Alpha',
    role: 'Initiator & Primary Derivator',
    provider: 'openai',
    model: 'gpt-4o',
    systemPrompt:
      'You are Phys-Alpha, a specialist in physics derivations. Your role is to initiate physics problems and establish foundational approaches. Focus on rigorous mathematical formulations and clear physical reasoning. Always provide COMPLETE derivations with ALL mathematical steps shown. Use LaTeX notation for equations (\\[ \\] for block equations, \\( \\) for inline). CRITICAL: Ensure your response is complete and thorough - do not stop mid-sentence, mid-equation, or mid-thought. Take your time to develop the complete mathematical framework.',
    temperature: 0.7,
    maxTokens: 8000,
    enabled: true
  },
  {
    id: 'phys-beta',
    name: 'Phys-Beta',
    role: 'Contributor & Extender',
    provider: 'openai',
    model: 'gpt-4o',
    systemPrompt:
      'You are Phys-Beta, a physics specialist who builds upon existing work. Your role is to extend and enhance derivations with additional insights, alternative approaches, and deeper analysis. Always provide COMPLETE mathematical derivations and thorough explanations. Use LaTeX notation for equations (\\[ \\] for block equations, \\( \\) for inline). CRITICAL: Ensure your response is complete and thorough - do not stop mid-sentence, mid-equation, or mid-thought. Continue writing until you have provided a complete and valuable contribution.',
    temperature: 0.8,
    maxTokens: 8000,
    enabled: true
  },
  {
    id: 'phys-gamma',
    name: 'Phys-Gamma',
    role: 'Oversight & Corrector',
    provider: 'openai',
    model: 'gpt-4o',
    systemPrompt:
      'You are Phys-Gamma, the oversight specialist. Your role is to review, correct, and ensure scientific rigor in physics derivations. Identify errors, suggest improvements, and make authoritative decisions about derivation quality. Provide COMPLETE analysis and corrections with full mathematical detail. Use LaTeX notation for equations (\\[ \\] for block equations, \\( \\) for inline). CRITICAL: Ensure your response is complete and thorough - do not stop mid-sentence, mid-equation, or mid-thought. Provide thorough review and complete recommendations.',
    temperature: 0.3,
    maxTokens: 8000,
    enabled: true
  }
]

export const MODEL_SUGGESTIONS: Partial<Record<LLMProvider, string[]>> = {
  spark: ['gpt-4o', 'gpt-4o-mini'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini'],
  openrouter: [
    'openrouter/auto',
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o-mini-2024-07-18',
    'google/gemini-flash-1.5',
    'mistralai/mistral-nemo'
  ],
  ollama: ['llama3.2', 'llama3.2:70b', 'phi3.5', 'mistral-nemo']
}

export const VALID_PROVIDERS: LLMProvider[] = ['spark', 'openai', 'openrouter', 'ollama']

export const cloneProviderDefaults = (): ProviderSettings =>
  JSON.parse(JSON.stringify(DEFAULT_PROVIDER_SETTINGS)) as ProviderSettings

export const cloneAgentDefaults = (): AgentConfig[] =>
  DEFAULT_AGENT_CONFIGS.map(config => ({ ...config }))

export const normalizeBaseUrl = (value: string | undefined, fallback: string): string => {
  const trimmed = value?.trim()
  const base = trimmed && trimmed.length > 0 ? trimmed : fallback
  return base.replace(/\/+$/u, '')
}

export const cloneAutonomousDefaults = (): AutonomousConfig => ({
  ...DEFAULT_AUTONOMOUS_CONFIG
})
