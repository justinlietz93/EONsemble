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
  metadata?: {
    tabChangeReason?: string
    lastDetectedReset?: string
  }
}

declare global {
  interface Window {
    __EONSessionTrace?: unknown
  }
}

function Harness({ tab, snapshot, metadata }: HarnessProps) {
  useSessionDiagnostics(tab, snapshot, metadata)
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
        metadata={{
          tabChangeReason: 'user-selection',
          lastDetectedReset: 'none',
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
    expect(infoMessages.some(message => message.includes('reason=user-selection'))).toBe(true)
    expect(infoMessages.some(message => message.includes('lastReset=none'))).toBe(true)
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
        metadata={{
          tabChangeReason: 'user-selection',
          lastDetectedReset: 'none',
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
        metadata={{
          tabChangeReason: 'persistence-reset',
          lastDetectedReset: 'persistence-reset',
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
      expect((resetCall?.[0] as string) ?? '').toContain('reason=persistence-reset')
      expect((resetCall?.[0] as string) ?? '').toContain('lastReset=persistence-reset')
    })
  })

  it('logs knowledge deltas and sample updates across snapshots', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { rerender } = render(
      <Harness
        tab="knowledge"
        snapshot={{
          activeGoalId: 'goal-xyz',
          knowledgeEntryCount: 2,
          knowledgeSample: [
            { id: 'k-1', title: 'First' },
            { id: 'k-2', title: 'Second' }
          ]
        }}
        metadata={{
          tabChangeReason: 'user-selection',
          lastDetectedReset: 'none'
        }}
      />
    )

    await waitFor(() => {
      expect(infoSpy).toHaveBeenCalled()
    })

    infoSpy.mockClear()

    rerender(
      <Harness
        tab="knowledge"
        snapshot={{
          activeGoalId: 'goal-xyz',
          knowledgeEntryCount: 5,
          knowledgeSample: [
            { id: 'k-1', title: 'First' },
            { id: 'k-2', title: 'Second' },
            { id: 'k-3', title: 'Third' }
          ]
        }}
        metadata={{
          tabChangeReason: 'user-selection',
          lastDetectedReset: 'none'
        }}
      />
    )

    await waitFor(() => {
      const increaseCall = infoSpy.mock.calls.find(([message]) =>
        (message as string).includes('Knowledge count increased')
      )
      expect(increaseCall).toBeDefined()
      expect((increaseCall?.[0] as string) ?? '').toContain('(+3)')
      expect((increaseCall?.[0] as string) ?? '').toContain('-> 5')
    })

    rerender(
      <Harness
        tab="knowledge"
        snapshot={{
          activeGoalId: 'goal-xyz',
          knowledgeEntryCount: 1,
          knowledgeSample: [
            { id: 'k-4', title: 'Replacement' }
          ]
        }}
        metadata={{
          tabChangeReason: 'persistence-reset',
          lastDetectedReset: 'persistence-reset'
        }}
      />
    )

    await waitFor(() => {
      const decreaseCall = warnSpy.mock.calls.find(([message]) =>
        (message as string).includes('Knowledge count decreased')
      )
      expect(decreaseCall).toBeDefined()
      expect((decreaseCall?.[0] as string) ?? '').toContain('-4')
      expect((decreaseCall?.[0] as string) ?? '').toContain('-> 1')
    })

    warnSpy.mockClear()
    infoSpy.mockClear()

    rerender(
      <Harness
        tab="knowledge"
        snapshot={{
          activeGoalId: 'goal-xyz',
          knowledgeEntryCount: 1,
          knowledgeSample: [
            { id: 'k-5', title: 'Shifted' }
          ]
        }}
        metadata={{
          tabChangeReason: 'user-selection',
          lastDetectedReset: 'none'
        }}
      />
    )

    await waitFor(() => {
      const sampleChangeCall = infoSpy.mock.calls.find(([message]) =>
        (message as string).includes('Knowledge sample changed at stable count')
      )
      expect(sampleChangeCall).toBeDefined()
      expect((sampleChangeCall?.[0] as string) ?? '').toContain('(1)')
    })
  })
})
