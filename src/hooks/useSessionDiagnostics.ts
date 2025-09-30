import { useEffect, useRef } from 'react'

const isDebugEnabled = (): boolean => {
  if (typeof window === 'undefined') {
    return false
  }

  const explicitFlag = window.localStorage?.getItem('eon.debugSessionTrace')
  if (explicitFlag) {
    return explicitFlag === 'true'
  }

  return import.meta.env.DEV ?? false
}

type SessionSnapshot = {
  activeGoalId: string | null
  knowledgeEntryCount: number
  knowledgeSample: Array<{ id: string; title: string }>
}

type SessionTrace = {
  mounts: number
  unmounts: number
  resets: number
  history: Array<{ tab: string; at: string }>
  snapshots: Array<SessionSnapshot & { tab: string; at: string }>
}

declare global {
  interface Window {
    __EONSessionTrace?: SessionTrace
  }
}

const ensureTrace = (): SessionTrace => {
  if (typeof window === 'undefined') {
    return { mounts: 0, unmounts: 0, resets: 0, history: [], snapshots: [] }
  }

  if (!window.__EONSessionTrace) {
    window.__EONSessionTrace = { mounts: 0, unmounts: 0, resets: 0, history: [], snapshots: [] }
  }

  return window.__EONSessionTrace
}

const formatKnowledgeSample = (sample: SessionSnapshot['knowledgeSample']): string => {
  if (sample.length === 0) {
    return '[]'
  }

  const preview = sample.slice(0, 3)
  const entries = preview.map((entry) => `${entry.id}:${entry.title}`)
  const suffix = sample.length > preview.length ? '…' : ''
  return `[${entries.join(', ')}${suffix}]`
}

export function useSessionDiagnostics(activeTab: string, snapshot: SessionSnapshot): void {
  const previousTab = useRef<string>('')
  const latestSnapshot = useRef<SessionSnapshot>(snapshot)

  useEffect(() => {
    latestSnapshot.current = snapshot
  }, [snapshot])

  useEffect(() => {
    if (!isDebugEnabled()) {
      return
    }

    const trace = ensureTrace()
    trace.mounts += 1
    trace.history.push({ tab: activeTab, at: new Date().toISOString() })
    const snapshotForLog = latestSnapshot.current
    trace.snapshots.push({ tab: activeTab, at: new Date().toISOString(), ...snapshotForLog })
    console.info(
      `[SessionTrace] App mounted (count=${trace.mounts}) -> activeTab=${activeTab} | goal=${snapshotForLog.activeGoalId ?? 'none'} | knowledgeCount=${snapshotForLog.knowledgeEntryCount} | sample=${formatKnowledgeSample(snapshotForLog.knowledgeSample)}`
    )

    return () => {
      const currentTrace = ensureTrace()
      currentTrace.unmounts += 1
      const snapshotForLog = latestSnapshot.current
      currentTrace.snapshots.push({ tab: activeTab, at: new Date().toISOString(), ...snapshotForLog })
      console.warn(
        `[SessionTrace] App unmounted (count=${currentTrace.unmounts}) -> lastTab=${activeTab} | goal=${snapshotForLog.activeGoalId ?? 'none'} | knowledgeCount=${snapshotForLog.knowledgeEntryCount} | sample=${formatKnowledgeSample(snapshotForLog.knowledgeSample)}`
      )
    }
  }, [activeTab])

  useEffect(() => {
    if (!isDebugEnabled()) {
      previousTab.current = activeTab
      return
    }

    const trace = ensureTrace()
    const prior = previousTab.current

    if (prior && prior !== activeTab && activeTab === 'goal-setup') {
      trace.resets += 1
      const snapshotForLog = latestSnapshot.current
      console.warn(
        `[SessionTrace] Active tab reset from ${prior} -> ${activeTab} (resets=${trace.resets}) | goal=${snapshotForLog.activeGoalId ?? 'none'} | knowledgeCount=${snapshotForLog.knowledgeEntryCount} | sample=${formatKnowledgeSample(snapshotForLog.knowledgeSample)}`
      )
    }

    if (!trace.history.some(entry => entry.tab === activeTab)) {
      trace.history.push({ tab: activeTab, at: new Date().toISOString() })
    }

    previousTab.current = activeTab
  }, [activeTab])
}
