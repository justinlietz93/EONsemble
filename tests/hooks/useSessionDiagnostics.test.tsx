import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { useSessionDiagnostics } from '@/hooks/useSessionDiagnostics'

interface HarnessProps {
  tab: string
  snapshot: {
    activeGoalId: string | null
    knowledgeEntryCount: number
    knowledgeSample: Array<{ id: string; title: string }>
  }
}

declare global {
  interface Window {
    __EONSessionTrace?: unknown
  }
}

function Harness({ tab, snapshot }: HarnessProps) {
  useSessionDiagnostics(tab, snapshot)
  return null
}

describe('useSessionDiagnostics', () => {
  beforeEach(() => {
    window.localStorage?.setItem('eon.debugSessionTrace', 'true')
    window.__EONSessionTrace = undefined
  })

  afterEach(() => {
    window.localStorage?.removeItem('eon.debugSessionTrace')
    window.__EONSessionTrace = undefined
    vi.restoreAllMocks()
  })

  it('logs the knowledge snapshot on mount when debugging is enabled', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    render(
      <Harness
        tab="knowledge"
        snapshot={{
          activeGoalId: 'goal-123',
          knowledgeEntryCount: 2,
          knowledgeSample: [
            { id: 'k-1', title: 'Alpha' },
            { id: 'k-2', title: 'Beta' },
          ],
        }}
      />
    )

    await waitFor(() => {
      expect(infoSpy).toHaveBeenCalled()
    })

    const infoMessages = infoSpy.mock.calls.map(([message]) => message as string)
    expect(infoMessages.some(message => message.includes('goal=goal-123'))).toBe(true)
    expect(infoMessages.some(message => message.includes('knowledgeCount=2'))).toBe(true)
    expect(infoMessages.some(message => message.includes('sample=[k-1:Alpha, k-2:Beta]'))).toBe(true)
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('logs knowledge details when a reset to goal-setup is detected', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { rerender } = render(
      <Harness
        tab="collaboration"
        snapshot={{
          activeGoalId: 'goal-789',
          knowledgeEntryCount: 3,
          knowledgeSample: [
            { id: 'k-10', title: 'Gamma' },
            { id: 'k-11', title: 'Delta' },
            { id: 'k-12', title: 'Epsilon' },
          ],
        }}
      />
    )

    await waitFor(() => {
      expect(infoSpy).toHaveBeenCalled()
    })

    rerender(
      <Harness
        tab="goal-setup"
        snapshot={{
          activeGoalId: null,
          knowledgeEntryCount: 1,
          knowledgeSample: [{ id: 'k-20', title: 'Zeta' }],
        }}
      />
    )

    await waitFor(() => {
      const resetCall = warnSpy.mock.calls.find(([message]) =>
        (message as string).includes('Active tab reset from')
      )
      expect(resetCall).toBeDefined()
      expect((resetCall?.[0] as string) ?? '').toContain('goal=none')
      expect((resetCall?.[0] as string) ?? '').toContain('knowledgeCount=1')
      expect((resetCall?.[0] as string) ?? '').toContain('sample=[k-20:Zeta]')
    })
  })
})
