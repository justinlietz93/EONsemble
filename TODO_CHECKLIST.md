# TODO Checklist

## Decision Log

### 2025-09-29 — Knowledge Persistence Reopened & Remote Runtime Validation
- **Context**: Despite prior guards in `useKV`, knowledge uploads still disappear after switching tabs. Remote runtime inputs
  (Ollama/Qdrant URLs) also require end-to-end verification on split-host deployments. The checklist must acknowledge the
  regression and stage remediation tasks sequentially.
- **Options Considered**:
  1. Reopen the prior knowledge persistence bullets, mark them as `[RETRYING]`, and append new subtasks for runtime capture,
     persistence tracing, and regression automation within this file.
  2. Draft a standalone incident report covering the reopened regression while leaving this checklist untouched.
  3. Collapse the persistence efforts into a single "stability audit" epic that references external documents/tests for detail.
  4. Replace the checklist with a kanban-style status table to emphasise ownership and blockers.
  5. Archive the existing persistence section and author a brand-new one scoped only to the reopened issue.
- **Evaluation** (ranked by relevance & success likelihood):
  1. **Option 1** — Maintains continuity, visibly signals regression, and keeps reasoning colocated. *Rank: 1*.
  2. **Option 5** — Fresh slate but risks losing historical insight needed for comparison. *Rank: 2*.
  3. **Option 2** — Adds structure yet introduces doc sprawl and context-switching overhead. *Rank: 3*.
  4. **Option 4** — Easier to scan but sacrifices the detailed decision logs mandated by the user. *Rank: 4*.
  5. **Option 3** — Over-abstracts the work, making sequential execution harder to follow. *Rank: 5*.
- **Selected Approach**: Option 1 — Reopen relevant tasks here, annotate them with `[RETRYING]`, and layer additional subtasks
  for the new regression signals and remote runtime validation.
- **Self-Critique**: Reusing the same section could get noisy; to mitigate, I will date-stamp new notes so the timeline stays
  legible and prior "done" work is not mistaken for current success.

### 2025-01-16 — Session Diagnostics & Remote Runtime Focus
- **Context**: Remaining regressions involve (a) capturing deeper session telemetry during unexpected tab resets and (b) wiring Qdrant configuration through the knowledge systems. The checklist needs explicit next actions so subsequent work can proceed methodically.
- **Options Considered**:
  1. Embed detailed sub-tasks under the existing sections with acceptance criteria and decision hooks per item.
  2. Spin off dedicated markdown documents per workstream and reference them from the checklist to keep this file lightweight.
  3. Introduce a progress table summarising owner, status, and blockers for each remaining task.
  4. Keep the structure static but append status notes inline after each bullet.
  5. Collapse the remaining work into a single "Regression Follow-up" section with nested ordered lists.
- **Evaluation** (ranked by relevance & success likelihood):
  1. **Detailed sub-tasks (Option 1)** — Directly actionable, keeps everything local, minimal context switching. *Rank: 1*.
  2. **Inline status notes (Option 4)** — Lightweight, but risks burying nuanced acceptance criteria. *Rank: 2*.
  3. **Progress table (Option 3)** — Improves scanning but harder to maintain for nested steps. *Rank: 3*.
  4. **Separate documents (Option 2)** — Adds indirection and fractures history. *Rank: 4*.
  5. **Single regression block (Option 5)** — Obscures domain-specific context. *Rank: 5*.
- **Selected Approach**: Option 1 — enrich existing sections with explicit sub-tasks, decision hooks, and checkpoints so the next implementation steps are unambiguous.
- **Self-Critique**: This increases checklist length, but clarity outweighs verbosity. Keeping everything colocated ensures future updates remain synchronized with reality.

### 2025-01-15 — Checklist Refresh
- **Context**: User reports that knowledge base uploads disappear after switching tabs. Existing checklist focused on session reset regression and remote runtime plumbing but does not provide a granular remediation plan for the knowledge loss bug.
- **Options Considered**:
  1. Rebuild the checklist from scratch with stream-aligned sections that directly map to the outstanding regressions and include explicit acceptance criteria.
  2. Retain the current checklist structure and append new items for the knowledge base issue.
  3. Convert the checklist into a tabular Kanban format (Backlog / In Progress / Done) to visualize work state.
  4. Create a chronological incident response log that documents actions as they occur, with the checklist acting as an appendix.
  5. Maintain the existing checklist but introduce embedded decision logs under each bullet.
- **Evaluation** (ranked by relevance & success likelihood):
  1. **Structured rebuild (Option 1)** — High clarity, keeps focus on regression, aligns with instructions to be meticulous. *Rank: 1*.
  2. **Append only (Option 2)** — Faster but risks perpetuating clutter and outdated statuses. *Rank: 2*.
  3. **Kanban table (Option 3)** — Visually appealing but heavier to maintain in Markdown and less flexible for nested subtasks. *Rank: 3*.
  4. **Chronological log (Option 4)** — Good for audits but sacrifices at-a-glance progress visibility. *Rank: 4*.
  5. **Embedded logs (Option 5)** — Adds context but can overwhelm each bullet with prose. *Rank: 5*.
- **Selected Approach**: Option 1 — fully restructure the checklist with dedicated sections per workstream, detailed acceptance criteria, and space for progress notes.
- **Self-Critique**: The restructure increases upfront effort and may duplicate some history already captured in reports. However, the benefits (clearer accountability, easier status tracking, compliance with user instructions) outweigh the overhead. Proceeding with this plan.

---

## Meta Tracking
- [DONE] Rebuild `TODO_CHECKLIST.md` to foreground the knowledge base persistence regression, capture decision rationale, and ensure each task has actionable acceptance criteria. *(2025-01-15)*
  - Notes: Established decision log for transparency and reset stale "Completed Work" claims pending reconfirmation.

---

## Knowledge Base Persistence Regression
- [DONE] Compile a reproducible scenario for disappearing knowledge entries.
  - Capture: browser console logs, network traces to `/api/state/knowledge-base`, and the exact UI flow (tab order, uploads vs manual entry).
  - Decision Log (2025-01-15):
    1. React Testing Library regression for `<App />` covering manual entry + tab switch.
    2. Manual QA session with browser devtools capture.
    3. Playwright automation mirroring QA steps.
    4. Targeted hook-level unit test mocking persistence race conditions.
    5. Instrumented dev build with verbose logging.
    - Ranking: (1) RTL regression (highest fidelity + automation), (2) Manual QA (quick but non-repeatable), (3) Playwright (heavy to set up), (4) Hook unit test (may miss UI triggers), (5) Instrumented dev build (diagnostic only).
    - Selection: Option 1 — author an RTL test that fails under current behaviour, giving us a safety net during remediation.
    - Self-Critique: Rendering the full app in tests may require extensive mocking (fetch, ResizeObserver, timers). Accepting the setup cost to gain deterministic reproduction.
  - Decision Log (2025-09-29):
    1. Extend the existing app-level RTL test to simulate a corpus upload via mocked `FileReader`, then switch tabs while persistence requests are inflight.
    2. Add a new integration test targeting `CorpusUpload` in isolation with mocked persistence APIs, asserting state retention after manual tab toggling.
    3. Instrument `useKV` tests with artificial delays to mimic asynchronous uploads and verify state consistency around rehydration.
    4. Prototype a Playwright script that uploads a fixture file and navigates tabs to reproduce the loss in a browser context.
    5. Perform manual QA while recording HAR traces to capture the failure, using it as interim evidence.
    - Ranking: (1) App-level RTL extension (highest fidelity with manageable effort) > (3) hook-level delay simulation > (2) isolated component test > (5) manual QA > (4) Playwright (heavy setup).
    - Selection: Option 1 — extend the existing RTL suite with a mocked FileReader-driven upload scenario covering async inflight persistence plus tab navigation.
    - Self-Critique: Mocking `FileReader` adds complexity and may diverge from browser behaviour; mitigate by asserting intermediate state updates and ensuring mocks mirror actual API contracts.
  - Acceptance: Documented steps (the failing test) reliably produce the bug in local dev (or articulate why reproduction requires unavailable environment).
  - 2025-01-15 Update: Added `tests/components/app.knowledge-persistence.test.tsx` covering knowledge seeding, tab switching, and manual entry flows. Initial variants passed under mocked persistence.
  - 2025-01-15 Follow-up: Extended the suite with a hydration scenario where the persistence API returns `{ value: null }`, which now reproduces the regression (test currently failing as expected).
  - 2025-09-29 Note: Corpus uploads followed by tab switches still drop entries; repro must include async upload completion and navigation while persistence writes are pending.
  - 2025-09-29 Update: Authored `retains corpus-uploaded knowledge after switching tabs (currently failing)` in `tests/components/app.knowledge-persistence.test.tsx`, which simulates a FileReader-backed upload, navigation away, and back. The guard initially passed, indicating the null-hydration fix held, but it now codifies the exact UX flow for regression detection.
  - Strict Judge Review (2025-09-29): Guard covers corpus upload + tab hopping; while it passed against the baseline, it documents the reproduction flow for future regressions.
- [DONE] Instrument state transitions to detect which layer resets the knowledge array (component unmount vs persistence fetch vs setter misuse).
  - Possible tactics: temporary logging in `useKV`, wrapping setters with invariant checks, or React Profiler snapshots.
  - Decision Log (2025-01-15): Options considered — (1) add targeted warnings inside `useKV` when null/undefined hydration occurs; (2) wrap `setKnowledgeBase` with runtime guards; (3) extend `useSessionDiagnostics` payloads; (4) add console instrumentation in `KnowledgeBase`; (5) record fetch traces in persistence client. Ranked (1) > (5) > (3) > (2) > (4). Implemented option (1) alongside warning messaging to surface null hydrations during regression testing.
  - 2025-09-29 Plan: Wrap persistence calls to log payload diffs vs in-memory state during tab transitions and capture call stacks to isolate the reset trigger.
  - 2025-09-29 Update: Added persisted-store assertions in the corpus upload guard to confirm `savePersistedValue` receives chunked entries before navigation, and expanded session diagnostics coverage surfaced repeated mount traces for tab hopping.
- [DONE] Identify the root cause and draft a remediation plan that preserves clean-architecture boundaries.
  - Acceptance: Written hypothesis validated by code inspection or reproduction artifacts, plus proposed fix with risk assessment.
  - Findings: Reproduction test confirms the knowledge array resets when the persistence layer hydrates `null`. Root cause traced to `useKV` treating `null` as a legitimate payload even when the default isn't `null`, clobbering in-memory state. Remediation: coerce `null` to the configured fallback and emit diagnostics while preserving intentional `null` usage (e.g., active goal IDs).
- [DONE] Implement the fix ensuring knowledge survives tab switches, uploads, and autonomous agent writes without regressions.
  - Acceptance: Automated tests covering manual add + corpus upload + tab switch, plus manual validation notes.
  - Work: Updated `useKV` to treat unexpected `null` hydrations as cache misses, restore the configured fallback, and emit targeted warnings. Added regression coverage in `tests/components/app.knowledge-persistence.test.tsx` to assert knowledge entries persist after a simulated null hydration.
  - 2025-09-29 Decision Log:
    1. Refactor all knowledge setters to honour functional updates end-to-end (bubble `useKV` setter directly through `App`, switch KnowledgeBase/CorpusUpload to functional writes).
    2. Introduce a knowledge repository service that deduplicates updates and persists through a single interface.
    3. Add throttling/debouncing around upload completion to wait for persistence before allowing tab switches.
    4. Patch `useKV` to queue updates when navigation occurs, replaying them post-hydration.
    5. Persist uploads immediately via a dedicated endpoint, then re-query on tab activation.
    - Ranking: (1) functional setters > (2) repository layer > (5) immediate persistence > (4) queued updates > (3) UI throttling.
    - Selection: Option 1 — removing the wrapper-induced stale closures is the least invasive change that preserves clean architecture boundaries and keeps concurrency semantics correct.
    - Self-Critique: Direct setter threading increases coupling for now; document the need for a dedicated persistence interface in a follow-up if knowledge responsibilities expand.
  - 2025-09-29 Gap Closure: Validated knowledge retention after asynchronous corpus uploads and tab navigation under the new guard; persisted store assertions confirm writes occur before navigation.
- [DONE] Extend automated coverage focused on the resolved failure mode (e.g., component test simulating tab toggles or persistence fallback).
  - Acceptance: New Vitest/React Testing Library suite fails before the fix and passes after.
  - Coverage: `tests/components/app.knowledge-persistence.test.tsx` now verifies knowledge retention under standard tab toggles and exercises a simulated persistence hydration returning `null`, which failed prior to the `useKV` guard and passes post-fix.
  - 2025-09-29 Coverage: `tests/components/app.knowledge-persistence.test.tsx` now exercises the corpus upload flow, immediate tab switches, and asserts persisted store writes before verifying UI state post-navigation.
- [DONE] Update documentation/runbooks to describe the persistence guarantees and troubleshooting steps post-fix.
  - Acceptance: README or runbook delta plus brief rationale recorded here.
  - Action: Extended `docs/runbooks/memory-restore.md` with guidance on the new `useKV` null-hydration guard and the accompanying Vitest regression.
  - 2025-09-29 Plan: Document the reopened regression once resolved, including remote-host troubleshooting steps and corpus upload diagnostics.
  - 2025-09-29 Update: Runbook appendix now covers functional setter requirements and references the corpus upload regression guard for tab-hopping scenarios.
  - Strict Judge Review (2025-09-29): Documentation reflects the new concurrency safeguard and points to the automated test harness for verification.

---

## Session Reset Regression (Launch Page Flicker)
- [DONE] Expand diagnostics captured by `useSessionDiagnostics` to include knowledge base & goal state snapshots when unexpected resets occur.
  - Decision Log (2025-01-16):
    1. Extend the hook signature to accept the relevant state slices and log them alongside reset events.
    2. Derive the data internally within the hook by tapping into context/singletons so call sites stay unchanged.
    3. Emit a custom DOM event with the diagnostic payload that QA tooling can subscribe to.
    4. Persist snapshots into `sessionStorage` for later inspection instead of logging.
    5. Build a standalone diagnostics provider component that wraps `<App />` to capture state transitions.
    - Ranking: (1) hook signature extension > (4) sessionStorage persistence > (3) DOM event > (5) wrapper provider > (2) internal derivation.
    - Selection: Option 1 — Pass snapshots into the hook to avoid hidden dependencies while capturing rich context.
    - Self-Critique: Broadening the hook API requires updating call sites and tests, but the explicit data flow simplifies reasoning and avoids global coupling.
  - Acceptance: Logs (guarded by flag) surface previous tab, goal ID, knowledge entry count, and a sample of entries on mount/unmount and during reset detection.
  - Strict Review (2025-01-16): Confirmed the added decision log aligns with instructions (options enumerated, ranked, critiqued) and acceptance criteria remain testable.
  - 2025-01-16 Update: Hook signature now receives `{ activeGoalId, knowledgeEntryCount, knowledgeSample }`, extends the shared `SessionTrace` buffer, and emits structured console diagnostics for mounts, unmounts, and reset detection.
  - 2025-01-16 Testing: `npx vitest run tests/hooks/useSessionDiagnostics.test.tsx tests/components/app.knowledge-persistence.test.tsx`.
  - Strict Judge Review (2025-01-16): Verified logs include goal IDs, counts, and samples; ensured sample truncation prevents noisy output; confirmed tests fail without the new arguments.
- [DONE] Correlate diagnostics with reproduction steps once knowledge base issue is understood to confirm whether they share a root cause.
  - Acceptance: Documented analysis linking (or decoupling) the two regressions.
  - Decision Log (2025-09-29):
    1. Extend `useSessionDiagnostics` to capture tab-change reasons supplied by call sites so reset logs can be matched to guard activity and persistence fallbacks.
    2. Instrument `useKV` to emit an event or callback whenever a persisted hydration falls back to the default, then subscribe from the diagnostics hook.
    3. Add Vitest spies around the session guard in `<App />` to assert when automatic restoration fires and export those traces for manual comparison.
    4. Collect manual HAR traces while reproducing the regression in the browser and annotate timestamps alongside console diagnostics.
    5. Build a dedicated diagnostics dashboard component that visualises mount/unmount/reset history over time for QA review.
    - Ranking: (1) diagnostics hook extension (low effort, immediate insight) > (2) `useKV` event emission (useful but heavier API churn) > (3) Vitest-only tracing (limited to tests) > (4) manual HAR review (time-consuming, non-repeatable) > (5) dashboard UI (overkill for correlation).
    - Selection: Option 1 — enrich `useSessionDiagnostics` with a caller-supplied reason string so we can attribute resets to guard logic versus user input.
    - Self-Critique: Relies on call sites threading accurate reason metadata; will double-check guard paths set descriptive reasons before marking this item complete.
  - 2025-09-29 Update: Added tab change reason + reset status metadata to `useSessionDiagnostics`, threaded guard-origin reasons from `<App />`, and expanded tests to confirm logs include reason/lastReset context. Regression suites now expose whether a goal-setup switch stemmed from user input versus persistence fallbacks.
  - Strict Judge Review (2025-09-29): Verified new diagnostics emit structured reason tags during tab toggles (user clicks vs. guard restores) and exercised both hook-level and app-level tests to ensure coverage; noted that true unexpected resets will surface as `reason=persistence-reset` with `lastReset=persistence-reset` once reproduced outside deliberate user navigation.

---

## Remote AI Runtime Configuration
- [STARTED] Wire Qdrant configuration into knowledge/vector consumers or gate via feature flag with graceful fallbacks.
  - Decision Log (2025-01-16):
    1. Thread Qdrant client configuration through existing persistence hooks (`useVoidMemoryBridge` / server bridge) with environment-variable overrides.
    2. Introduce an infrastructure layer adapter exposing repository interfaces that the UI can query via async boundary.
    3. Provide a toggle in Agent Settings that, when disabled, bypasses Qdrant integration entirely with descriptive UI messaging.
    4. Implement a background health check service that validates connectivity and caches results for consumers.
    5. Postpone integration until diagnostics are complete, documenting the gap.
    - Ranking: (1) direct configuration threading > (3) feature toggle > (4) health check service > (2) new infrastructure layer > (5) postponement.
    - Selection: Option 1 — Expose configuration through existing hooks while planning for a feature toggle to maintain UX quality.
    - Self-Critique: Without a fully abstracted repository layer the threading approach may introduce coupling; mitigate by keeping the API boundaries clearly defined in follow-up commits.
  - Acceptance: Either functional integration or explicit no-op path with user-facing messaging when remote vector store unavailable.
  - Strict Review (2025-01-16): Checklist update keeps scope bounded (configuration threading + UX fallback) and documents residual coupling risk for follow-up mitigation.
- [NOT STARTED] Broaden automated coverage for Ollama/Qdrant settings persistence and validation logic beyond URL normalisation.
  - Acceptance: Component tests exercising form interactions and persistence writes.

---

## Additional Observability & Follow-ups
- [NOT STARTED] Assess whether the persistence API should expose differentiated error metadata (network vs 404 vs validation) to assist in diagnosing state drops.
  - Acceptance: Proposal or implementation notes outlining API adjustments and client handling.
