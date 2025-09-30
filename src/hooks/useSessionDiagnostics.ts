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

type SessionMetadata = {
  tabChangeReason?: string
  lastDetectedReset?: string
}

type SessionHistoryEntry = {
  tab: string
  at: string
  reason?: string
  lastReset?: string
}

type SessionTrace = {
  mounts: number
  unmounts: number
  resets: number
  history: SessionHistoryEntry[]
  snapshots: Array<SessionSnapshot & SessionHistoryEntry>
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

const formatReason = (reason?: string): string => {
  if (!reason || reason.trim().length === 0) {
    return 'unknown'
  }

  return reason
}

const formatLastReset = (lastReset?: string): string => {
  if (!lastReset || lastReset.trim().length === 0 || lastReset === 'none') {
    return 'none'
  }

  return lastReset
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

export function useSessionDiagnostics(
  activeTab: string,
  snapshot: SessionSnapshot,
  metadata?: SessionMetadata
): void {
  const previousTab = useRef<string>('')
  const latestSnapshot = useRef<SessionSnapshot>(snapshot)
  const latestMetadata = useRef<SessionMetadata>({})

  useEffect(() => {
    latestSnapshot.current = snapshot
  }, [snapshot])

  useEffect(() => {
    latestMetadata.current = metadata ?? {}
  }, [metadata])

  useEffect(() => {
    if (!isDebugEnabled()) {
      return
    }

    const trace = ensureTrace()
    trace.mounts += 1
    const now = new Date().toISOString()
    const snapshotForLog = latestSnapshot.current
    const metadataForLog = latestMetadata.current
    const historyEntry: SessionHistoryEntry = {
      tab: activeTab,
      at: now,
      reason: metadataForLog.tabChangeReason,
      lastReset: metadataForLog.lastDetectedReset
    }
    trace.history.push(historyEntry)
    trace.snapshots.push({ ...historyEntry, ...snapshotForLog })
    console.info(
      `[SessionTrace] App mounted (count=${trace.mounts}) -> activeTab=${activeTab} | goal=${snapshotForLog.activeGoalId ?? 'none'} | knowledgeCount=${snapshotForLog.knowledgeEntryCount} | sample=${formatKnowledgeSample(snapshotForLog.knowledgeSample)} | reason=${formatReason(metadataForLog.tabChangeReason)} | lastReset=${formatLastReset(metadataForLog.lastDetectedReset)}`
    )

    return () => {
      const currentTrace = ensureTrace()
      currentTrace.unmounts += 1
      const snapshotForLog = latestSnapshot.current
      const metadataForLog = latestMetadata.current
      const now = new Date().toISOString()
      const historyEntry: SessionHistoryEntry = {
        tab: activeTab,
        at: now,
        reason: metadataForLog.tabChangeReason,
        lastReset: metadataForLog.lastDetectedReset
      }
      currentTrace.history.push(historyEntry)
      currentTrace.snapshots.push({ ...historyEntry, ...snapshotForLog })
      console.warn(
        `[SessionTrace] App unmounted (count=${currentTrace.unmounts}) -> lastTab=${activeTab} | goal=${snapshotForLog.activeGoalId ?? 'none'} | knowledgeCount=${snapshotForLog.knowledgeEntryCount} | sample=${formatKnowledgeSample(snapshotForLog.knowledgeSample)} | reason=${formatReason(metadataForLog.tabChangeReason)} | lastReset=${formatLastReset(metadataForLog.lastDetectedReset)}`
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
      const metadataForLog = latestMetadata.current
      console.warn(
        `[SessionTrace] Active tab reset from ${prior} -> ${activeTab} (resets=${trace.resets}) | goal=${snapshotForLog.activeGoalId ?? 'none'} | knowledgeCount=${snapshotForLog.knowledgeEntryCount} | sample=${formatKnowledgeSample(snapshotForLog.knowledgeSample)} | reason=${formatReason(metadataForLog.tabChangeReason)} | lastReset=${formatLastReset(metadataForLog.lastDetectedReset)}`
      )
    }

    if (!trace.history.some(entry => entry.tab === activeTab)) {
      const metadataForLog = latestMetadata.current
      trace.history.push({
        tab: activeTab,
        at: new Date().toISOString(),
        reason: metadataForLog.tabChangeReason,
        lastReset: metadataForLog.lastDetectedReset
      })
    }

    previousTab.current = activeTab
  }, [activeTab])
}
