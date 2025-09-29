import type { AgentConfig, ProviderSettings } from '@/types/agent'
import type { AgentName } from '@/lib/knowledge-utils'

import { COMPLETION_MARKER, MAX_CONTINUATION_ATTEMPTS, TERMINAL_CHARACTERS } from './constants'
import {
  buildContinuationUserPrompt,
  buildChatMessages,
  buildTextPrompt,
  type ContextSections
} from './prompt-builders'
import { callProviderLLM } from './providers'

const CONTINUATION_RETRY_BASE_DELAY_MS = 250

const wait = async (ms: number): Promise<void> =>
  new Promise(resolve => {
    if (ms <= 0) {
      resolve()
      return
    }

    setTimeout(resolve, ms)
  })

export async function ensureCompletion(
  agentConfig: AgentConfig,
  initialResponse: string,
  contextSections: ContextSections,
  agentName: AgentName,
  providerConfigs?: ProviderSettings
): Promise<string> {
  let response = initialResponse
  let attempt = 0

  while (!isResponseComplete(response) && attempt < MAX_CONTINUATION_ATTEMPTS) {
    const missingMarker = !containsCompletionMarker(response)
    console.warn(
      `Response from ${agentName} ${missingMarker ? 'missing completion marker' : 'appears truncated'}. Attempting continuation ${attempt + 1}.`
    )
    const continuationPrompt = buildContinuationUserPrompt(missingMarker, response, contextSections)
    const continuationMessages = buildChatMessages(agentConfig.systemPrompt, continuationPrompt)
    const continuationTextPrompt = buildTextPrompt(agentConfig.systemPrompt, continuationPrompt)

    const continuation = await callProviderLLM(
      agentConfig,
      providerConfigs,
      continuationMessages,
      continuationTextPrompt
    )

    response = `${response.trim()}\n\n${continuation.trim()}`
    attempt += 1

    if (!isResponseComplete(response) && attempt < MAX_CONTINUATION_ATTEMPTS) {
      const backoffMs = CONTINUATION_RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1)
      await wait(backoffMs)
    }
  }

  if (!containsCompletionMarker(response)) {
    console.warn(
      `Response from ${agentName} still missing completion marker after ${MAX_CONTINUATION_ATTEMPTS} attempts. Appending closure notice.`
    )
    response = `${response.trim()}\n\nCompletion marker was not automatically generated. Adding concluding marker now.\n${COMPLETION_MARKER}`
  } else if (!isResponseComplete(response)) {
    console.warn(
      `Response from ${agentName} remained structurally incomplete after ${MAX_CONTINUATION_ATTEMPTS} attempts. Normalizing with manual closure.`
    )
    const trimmedResponse = response.trimEnd()
    const markerIndex = trimmedResponse.lastIndexOf(COMPLETION_MARKER)
    const withoutMarker =
      markerIndex === -1 ? trimmedResponse : trimmedResponse.slice(0, markerIndex).trimEnd()
    response = `${withoutMarker}\n\nAutonomous run terminated early; marker appended to maintain protocol.\n${COMPLETION_MARKER}`
  }

  return response
}

export function normalizeCompletedResponse(response: string): string {
  const markerIndex = response.lastIndexOf(COMPLETION_MARKER)
  if (markerIndex === -1) {
    return response.trim()
  }

  const beforeMarker = response.slice(0, markerIndex).trim()
  return `${beforeMarker}\n${COMPLETION_MARKER}`
}

function containsCompletionMarker(response: string): boolean {
  return response.includes(COMPLETION_MARKER)
}

function isResponseComplete(response: string): boolean {
  if (!containsCompletionMarker(response)) {
    return false
  }

  const markerIndex = response.lastIndexOf(COMPLETION_MARKER)
  if (markerIndex === -1) {
    return false
  }

  const beforeMarker = response.slice(0, markerIndex).trim()
  if (!beforeMarker) {
    return false
  }

  if (hasUnbalancedStructures(beforeMarker)) {
    return false
  }

  const trimmed = beforeMarker.replace(/\s+$/u, '')
  const lastCharacter = trimmed.at(-1) ?? ''
  if (!TERMINAL_CHARACTERS.has(lastCharacter)) {
    return false
  }

  return true
}

function hasUnbalancedStructures(text: string): boolean {
  const codeFences = (text.match(/```/g) || []).length
  if (codeFences % 2 !== 0) {
    return true
  }

  const inlineMathOpen = (text.match(/\\\(/g) || []).length
  const inlineMathClose = (text.match(/\\\)/g) || []).length
  if (inlineMathOpen !== inlineMathClose) {
    return true
  }

  const blockMathOpen = (text.match(/\\\[/g) || []).length
  const blockMathClose = (text.match(/\\\]/g) || []).length
  if (blockMathOpen !== blockMathClose) {
    return true
  }

  const beginEnvironments = (text.match(/\\begin\{[^}]+\}/g) || []).length
  const endEnvironments = (text.match(/\\end\{[^}]+\}/g) || []).length
  if (beginEnvironments !== endEnvironments) {
    return true
  }

  const leftDelimiters = (text.match(/\\left/g) || []).length
  const rightDelimiters = (text.match(/\\right/g) || []).length
  if (leftDelimiters !== rightDelimiters) {
    return true
  }

  if (hasImbalancedStandardDelimiters(text)) {
    return true
  }

  return false
}

function hasImbalancedStandardDelimiters(text: string): boolean {
  const sanitized = text.replace(/```[\s\S]*?```/g, '')
  // Allow a tolerance of one unmatched delimiter for each pair to avoid
  // prematurely rejecting responses that include conversational fragments or
  // partially generated code. If stricter validation is required, reduce the
  // tolerance to zero for the relevant delimiters.
  const pairs: { open: string; close: string; tolerance: number }[] = [
    { open: '(', close: ')', tolerance: 1 },
    { open: '[', close: ']', tolerance: 1 },
    { open: '{', close: '}', tolerance: 1 }
  ]

  return pairs.some(({ open, close, tolerance }) => {
    const openCount = (sanitized.match(new RegExp(`\\${open}`, 'g')) || []).length
    const closeCount = (sanitized.match(new RegExp(`\\${close}`, 'g')) || []).length
    return Math.abs(openCount - closeCount) > tolerance
  })
}
