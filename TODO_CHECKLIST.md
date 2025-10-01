# TODO Checklist

## Decision Log

### 2025-09-29 — Knowledge Mirror Guard Still Loses Entries After Tab Switch
- **Context**: The live app continues to drop the knowledge counter to zero immediately after switching away from and back to
  the Knowledge tab, even after implementing the metadata-based mirror guard. This indicates either the guard is not covering
  the real-world sequence (likely involving component unmount/mount cycles) or another consumer is clearing the state. We need
  to reopen the investigation with explicit reproduction coverage and richer instrumentation before attempting a new fix.
- **Options Considered**:
  1. Extend the app-level regression suite with a realistic tab-switch harness that mounts/unmounts `<KnowledgeBase />` and
     delays persistence hydration to mimic the live repro.
  2. Add structured tracing inside `useKV` (and consumers like `KnowledgeBase`) to emit lifecycle events into the console and
     session diagnostics, capturing when state is replaced, merged, or cleared.
  3. Introduce a time-travel snapshot buffer that stores N previous `knowledge-base` states in memory so we can diff the last
     good payload against the unexpected empty array for post-mortem analysis.
  4. Prototype a lightweight IndexedDB adapter for `useKV` to validate whether synchronous `localStorage` is hitting limits or
     throttling, causing mirror writes to fail silently in the browser.
  5. Revert the metadata guard and rebuild with a simpler "prefer longest array" heuristic to see if complexity is hiding a
     logic error.
- **Evaluation** (ranked by relevance & likelihood of success):
  1. **Option 1** — Deterministic reproduction in tests is the fastest path to understand the failing sequence. *Rank: 1*.
  2. **Option 2** — Instrumentation complements tests and provides real user insight; requires careful log hygiene. *Rank: 2*.
  3. **Option 3** — Helpful for audits but adds runtime overhead without directly surfacing the bug. *Rank: 3*.
  4. **Option 4** — Valuable exploration but likely overkill before confirming the guard truly fails. *Rank: 4*.
  5. **Option 5** — Simplifying heuristics risks reintroducing earlier races without guaranteeing a fix. *Rank: 5*.
- **Selected Approach**: Option 1 — Build a high-fidelity regression that reproduces the tab-switch flow, then layer Option 2
  instrumentation to capture runtime evidence if the automated test still passes. Treat Options 3–5 as fallbacks if the root
  cause remains elusive.
- **Self-Critique**: Leaning on additional tests may still miss environment-specific behaviour (e.g., sessionStorage restores).
  Mitigate by wiring the new instrumentation into session diagnostics so manual repros emit actionable traces before attempting
  riskier storage changes.

### 2025-09-29 — Server Hydration Returns Empty Arrays After Successful Sync
- **Context**: Manual QA shows knowledge entries disappearing immediately after navigation even when local mirrors contain the
  uploaded data and persistence writes resolve successfully. The current guard only skips hydration when pending sync metadata
  exists, so an unexpected empty array from the backend can still overwrite the mirror and memory store. We need an additional
  acceptance heuristic that treats clearly regressive hydrations (e.g., payload shrinkage) as stale and replays the mirror
  payload back to the server.
- **Options Considered**:
  1. Extend `useKV` with a `shouldAcceptHydration` predicate so consumers can veto specific payloads (e.g., shrinkage beyond a
     tolerance) and trigger a resync.
  2. Implement a generic payload digest inside the metadata record (length + hash) and compare digests before accepting
     hydration.
  3. Force a secondary confirmation fetch before mutating state; only accept hydration when two consecutive responses match.
  4. Wrap knowledge-specific logic around the hook (e.g., `useKnowledgeStore`) that compares incoming payload size against a
     session snapshot and restores when it shrinks unexpectedly.
  5. Defer all hydrations until a human confirms the payload via UI prompt whenever it would drop entries.
- **Evaluation** (ranked by relevance & likelihood of success):
  1. **Option 1** — Minimal API surface, empowers consumers with domain heuristics, easy to test. *Rank: 1*.
  2. **Option 2** — Helpful for detecting divergence but adds metadata churn and hash maintenance. *Rank: 2*.
  3. **Option 4** — Keeps hook untouched but fragments logic and duplicates persistence wiring. *Rank: 3*.
  4. **Option 3** — Doubles network load and delays UI updates without guaranteeing fidelity. *Rank: 4*.
  5. **Option 5** — Blocks UX behind prompts and risks decision fatigue. *Rank: 5*.
- **Selected Approach**: Option 1 — add an optional hydration acceptance predicate to `useKV`, apply a shrinkage-aware guard for
  knowledge arrays, and auto-resubmit the preserved mirror payload when rejected.
- **Self-Critique**: Consumer-provided predicates must stay side-effect free; will ensure the hook handles logging/resync to
  avoid inconsistent behaviour across call sites.

### 2025-09-29 — Knowledge Base Still Resets After Tab Switch
- **Context**: Despite the hydration guard and regression suites, the user still sees the knowledge counter drop to zero after
  corpus uploads whenever they navigate away and back. The checklist must capture the reopened failure so we can treat the prior
  "done" items as provisional and plan the next investigative steps.
- **Options Considered**:
  1. Reclassify the affected knowledge persistence bullets as `[RETRYING]`, append fresh acceptance criteria, and document the
     discrepancy between automated coverage and the live repro.
  2. Spin up a brand-new "Knowledge Loss v2" section that references the original work while leaving historical `[DONE]`
     statuses untouched.
  3. Move the regression details into a separate incident report and link from the checklist to keep this file shorter.
  4. Replace the long-form narrative with a matrix (task × status × latest observation) for quicker scanning.
  5. Archive the existing section entirely and rebuild it from scratch to avoid conflating new and old reasoning.
- **Evaluation** (ranked by relevance & likelihood of success):
  1. **Option 1** — Keeps continuity, makes the regression explicit, and enables incremental updates without fragmenting history.
     *Rank: 1*.
  2. **Option 2** — Easier to skim but risks duplicating prior rationale; some context would be lost. *Rank: 2*.
  3. **Option 4** — Improves scanability yet sacrifices the mandated decision-log depth. *Rank: 3*.
  4. **Option 5** — Heavy-handed reset that erases earlier learnings. *Rank: 4*.
  5. **Option 3** — Spreads context across documents, increasing overhead during step-by-step execution. *Rank: 5*.
- **Selected Approach**: Option 1 — Reopen the pertinent bullets with `[RETRYING]`, annotate them with new acceptance criteria,
  and cross-reference the failing live scenario versus passing tests.
- **Self-Critique**: This will bloat the section with additional annotations; to mitigate noise I will timestamp the new notes and
  clearly separate prior success evidence from the new regression data.

### 2025-09-29 — Knowledge Base Tab Loss Reopening
- **Context**: Live sessions still drop knowledge entries to zero immediately after changing top-level tabs despite the hydration
  race guard. Reproduction captures indicate the persistence API occasionally returns an empty payload after the tab change and
  before the local write flush completes, leaving the UI with no entries until a manual refresh or re-upload. The checklist needs
  to stage remediation with explicit fallbacks that work even when the persistence endpoint is slow or unreachable.
- **Options Considered**:
  1. Mirror `useKV` writes into `localStorage` and treat it as an authoritative fallback whenever server hydration yields
     `undefined`/`null`, ensuring intra-session survival without waiting for the backend.
  2. Defer tab switches until the persistence PUT resolves successfully, effectively blocking navigation on outstanding writes.
  3. Implement an optimistic cache layer that snapshots knowledge state on every mutation and restores it when hydration returns
     an empty array, while still awaiting the backend for long-term storage.
  4. Introduce a background reconciliation task that continuously retries failed persistence writes and replays them after tab
     switches.
  5. Persist knowledge updates to a dedicated IndexedDB store managed via a service worker, providing a more robust offline cache
     than `localStorage`.
- **Evaluation** (ranked by relevance & likelihood of success):
  1. **Option 1** — Minimal surface area, immediate resilience against slow/offline persistence, easy to test in unit scope.
     *Rank: 1*.
  2. **Option 3** — Provides optimistic recovery but duplicates caching logic already present in `useKV`. *Rank: 2*.
  3. **Option 2** — Prevents state loss but harms UX by blocking navigation on IO. *Rank: 3*.
  4. **Option 4** — Adds significant complexity and delayed consistency semantics for a problem we can solve locally. *Rank: 4*.
  5. **Option 5** — Powerful but disproportionate for the current regression, and heavier to ship/test. *Rank: 5*.
- **Selected Approach**: Option 1 — Extend `useKV` with a resilient browser storage mirror (namespaced `localStorage`) that seeds
  the in-memory store before server hydration and updates on every write.
- **Self-Critique**: `localStorage` has size limits and synchronous semantics; we must keep payloads small and guard against
  serialization errors. Will add explicit warnings + tests to ensure large knowledge uploads degrade gracefully rather than
  throwing.

### 2025-09-29 — Mirror Persistence Overwrites After Unsynced Writes
- **Context**: Live repro shows that when the persistence API never stores the most recent knowledge upload (e.g., backend offline), the browser mirror seeds the UI correctly on reload but gets clobbered moments later once hydration returns an empty array. We need a guard that recognises unsynced local writes and resists stale server payloads until reconciliation succeeds.
- **Options Considered**:
  1. Track per-key sync metadata (last updated vs. last persisted timestamps) inside the storage adapter and skip server hydration when the mirror indicates pending writes.
  2. Compare payload hashes/lengths between mirror and server and keep whichever contains more entries for array-valued keys.
  3. Queue writes through a dedicated persistence worker that retries until the backend acknowledges the payload, keeping the worker authoritative.
  4. Replace the adapter with IndexedDB and transactional writes so failed PUTs never leave the browser in an inconsistent state.
  5. Prompt the user whenever hydration would drop entries, letting them decide whether to keep the mirror or accept the server payload.
- **Evaluation** (ranked by relevance & likelihood of success):
  1. **Option 1** — Minimal UI impact, deterministic, keeps logic centralised in `useKV`. *Rank: 1*.
  2. **Option 2** — Works for arrays but brittle for arbitrary value shapes. *Rank: 2*.
  3. **Option 3** — Adds resilience but introduces background complexity for every key. *Rank: 3*.
  4. **Option 5** — Transparent but noisy, adds friction to common flows. *Rank: 4*.
  5. **Option 4** — Heavy migration with little benefit beyond current need. *Rank: 5*.
- **Selected Approach**: Option 1 — Persist sync metadata per key, gate hydration when unsynced writes exist, and auto-resubmit the latest mirror payload to the backend.
- **Self-Critique**: Metadata tracking increases adapter complexity; must document the format and guard against JSON migration issues so existing stored values remain readable.

### 2025-09-29 — Hydration Race & Remote Runtime Validation
- **Context**: Despite prior guards in `useKV`, knowledge uploads still disappear after switching tabs whenever the persistence
  hydration resolves after a local write. Remote runtime inputs
  (Ollama/Qdrant URLs) also require end-to-end verification on split-host deployments. The checklist must acknowledge the
  regression and stage remediation tasks sequentially.
- **Options Considered**:
  1. Reopen the prior knowledge persistence bullets, mark them as `[RETRYING]`, and append new subtasks for racing hydration,
     remote runtime capture, and regression automation directly here.
  2. Draft a standalone incident report covering the reopened regression while leaving this checklist untouched.
  3. Collapse the persistence efforts into a single "stability audit" epic that references external documents/tests for detail.
  4. Replace the checklist with a kanban-style status table to emphasise ownership and blockers.
  5. Archive the existing persistence section and author a brand-new one scoped only to the reopened issue.
- **Evaluation** (ranked by relevance & success likelihood):
  1. **Option 1** — Maintains continuity, visibly signals regression, and keeps reasoning colocated with the race analysis.
     *Rank: 1*.
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
- [RETRYING] Guarantee knowledge entries survive tab switches even when persistence hydration returns `undefined`/`null` or
  races ahead of local writes.
  - Decision Log (2025-09-29): Adopt the `localStorage` mirror approach captured in "Knowledge Base Tab Loss Reopening".
  - Acceptance Criteria:
    1. `useKV` seeds state from a namespaced browser storage mirror before server hydration completes.
    2. Knowledge uploads remain visible after switching away from and back to the Knowledge tab with the persistence server
       offline.
    3. Unit tests cover hydration from the mirror store and verify that serialization failures surface as console warnings rather
       than crashes.
    4. Documentation (runbook or README) explains the fallback behaviour and outlines storage limits / troubleshooting.
  - Reopened Action Plan (2025-09-29):
    1. ✅ Persist per-key sync metadata (last update + last successful persist) alongside the mirror and skip stale server hydration when pending writes exist. *(Completed 2025-09-29 via `useKV` metadata refs and adapter updates.)*
    2. ✅ Retry persistence writes automatically when hydration reveals the backend is missing the mirror payload, with diagnostic logging for repeated failures. *(Completed 2025-09-29 by invoking `pushToPersistence` during hydration when pending sync metadata is present.)*
    3. ✅ Expand the regression suite with a case where the server returns an empty array while the mirror retains entries, ensuring the UI keeps the mirror data. *(Completed 2025-09-29 through new hook + component tests.)*
    4. ✅ Amend documentation with the sync-metadata behaviour, storage format, and recovery commands. *(Completed 2025-09-29 in `docs/runbooks/memory-restore.md`.)*
    5. ✅ Build a high-fidelity regression harness that reproduces the live tab-switch flow (mount/unmount + delayed hydration) to confirm the guard covers real-world timing. *(2025-09-29: Added cross-tab deferred upload regression in `tests/components/app.knowledge-persistence.test.tsx`.)*
    6. ✅ Thread structured `knowledge-base` state change logs into `useSessionDiagnostics` to capture future regressions with contextual evidence. *(2025-09-29: Added knowledge delta/sample logging with expanded hook tests.)*
    7. [DONE] Introduce shrinkage-aware hydration guards so empty backend payloads cannot overwrite richer mirror data when metadata claims the writes succeeded. *(2025-09-29 Evening: Added `shouldAcceptHydration` predicate support to `useKV`, wired knowledge-base guard in `App.tsx`, and extended hook regressions with a shrinkage veto case.)*
  - Strict Judge Checklist: Confirm no additional regressions in agentic operations (`AutonomousEngine` single + continuous run)
    after the persistence changes.
  - Implementation Options Review (2025-09-29):
    1. Inject a pluggable storage adapter into `useKV`, defaulting to `localStorage`, so tests can supply in-memory mocks.
    2. Hard-code a `localStorage` mirror inside the hook with feature detection and graceful failure logging.
    3. Build a separate `usePersistentKV` hook that wraps `useKV` and handles the mirror layer, leaving the base hook untouched.
    4. Introduce a global persistence service singleton that orchestrates memory, browser storage, and server writes.
    5. Mirror writes inside each consumer component (KnowledgeBase, AgentCollaboration) rather than at the hook level.
    - Ranking: (1) pluggable adapter (testable, flexible) > (2) hard-coded mirror (simpler but less testable) > (4) global
      service (overkill) > (3) wrapper hook (duplicative API) > (5) per-component mirror (error prone).
    - Selected: Option 1 — Add an internal adapter abstraction but default it to a `localStorage` implementation, enabling
      dependency injection in tests without rewriting all consumers.
    - Self-Critique: Adapter pattern adds indirection; must keep API minimal (`read`, `write`, `remove`) to avoid complexity.
  - Status Notes (2025-09-29): Reopened after observing that server hydration overwrites unsynced mirror data when the backend misses recent uploads. Metadata guard + retry loop pending. Tests need to reflect the stale-server scenario. Strict Judge review deferred until the metadata patch lands and agentic entry points are retested.
  - Status Notes (2025-09-29 — PM): Implemented the sync-metadata guard, automatic resubmission of mirror payloads, and adapter helpers for metadata storage. Added targeted regressions (`tests/hooks/useKV.test.tsx`, `tests/components/app.knowledge-sync.test.tsx`) plus reran the legacy persistence suite and screen smoke tests. Strict Judge Review: Verified agentic operations via `npx vitest run tests/components/screens.test.tsx` and ensured metadata-protected hydrations leave knowledge intact while reissuing persistence PUTs.
  - Status Notes (2025-09-29 — Late PM Reopen): Live manual repro still empties knowledge after tab switches. Status set to `[RETRYING]` until the new regression harness fails pre-fix, passes post-fix, and diagnostics confirm no silent clears occur during navigation.
  - Status Notes (2025-09-29 — Diagnostics): `useSessionDiagnostics` now emits console traces for knowledge count deltas and sample churn, guarding against silent resets. Hook tests cover increase/decrease/sample-change cases, giving observers richer breadcrumbs during manual repro.
  - Status Notes (2025-09-29 — Regression Harness): Added `retains knowledge after navigating across collaboration and settings tabs during deferred uploads` to `tests/components/app.knowledge-persistence.test.tsx`, covering multi-tab unmount/mount cycles with delayed FileReader completion. The test currently passes, indicating the live failure likely stems from an environment-specific condition not yet modelled.
- [DONE] Document and reproduce the hydration race where late-arriving persistence reads overwrite fresh local writes.
  - Decision Log (2025-09-29):
    1. Extend the existing RTL suite with a controllable fetch promise that resolves after a local corpus upload.
    2. Build a dedicated `useKV` unit test that simulates deferred hydration using manual promise controls.
    3. Use Playwright to reproduce the race in a headless browser with throttled network conditions.
    4. Capture manual HAR traces while toggling tabs immediately after uploads and annotate timestamps.
    5. Instrument the server persistence handler to delay responses during local QA sessions.
    - Ranking: (2) `useKV` unit test (direct focus, minimal UI noise) > (1) RTL suite (higher fidelity but heavier setup)
      > (3) Playwright (slow) > (4) manual HAR (non-repeatable) > (5) server instrumentation (intrusive).
    - Selected Approach: Option 2 — craft a `useKV` unit test with deferred hydration to reproduce the state clobber.
    - Self-Critique: Unit scope may miss integration nuances; will complement with app-level smoke once guard lands.
  - Status Notes (2025-09-29): Added `drops stale persisted values when hydration resolves after a newer local update` in `tests/hooks/useKV.test.tsx`, which failed prior to the guard and now codifies the race. *Strict Judge Review*: Confirms the test exercises pending hydration plus local writes and fails without the fix.
- [DONE] Guard against stale hydration overwriting more recent local updates inside `useKV`.
  - Decision Log (2025-09-29):
    1. Track a revision counter per key and drop hydration results if a newer local write occurred mid-flight.
    2. Cancel inflight hydration once a local write happens by leveraging `AbortController`.
    3. Queue hydration completion but merge arrays/maps instead of full replacement.
    4. Serialize updates through a mutex so hydration waits for pending writes to flush first.
    5. Defer hydration entirely until the first paint settles, trading freshness for safety.
    - Ranking: (1) revision counter (simple, deterministic) > (2) abort controller (requires fetch support + plumbing)
      > (3) merge semantics (data-shape-specific) > (4) mutex (complex) > (5) delayed hydration (UI lag).
    - Selected Approach: Option 1 — revision counters drop stale payloads without altering API shape.
    - Self-Critique: Requires careful synchronization to avoid skipping legitimate remote updates; will assert via tests.
  - Status Notes (2025-09-29): Revision + local-write guards prevent stale hydrations from clobbering state; verified via the new regression test and manual code audit to ensure defaults no longer reset revisions. *Strict Judge Review*: Checked that inline default arrays no longer reset the revision counter.
- [DONE] Extend automated coverage to fail when hydration clobbers local updates.
  - Decision Log (2025-09-29):
    1. Add a `useKV` regression test using controlled promises to emulate the race.
    2. Expand `app.knowledge-persistence.test.tsx` with a mock fetch that resolves late.
    3. Introduce a Cypress smoke test covering manual reproduction with network throttling.
    4. Add a server-level unit test to ensure persistence read/write ordering remains consistent.
    5. Record a Playwright trace for manual review but not automation.
    - Ranking: (1) hook regression (fast, targeted) > (2) RTL extension (comprehensive but slower)
      > (4) server test (less coverage of UI) > (3) Cypress (infrastructure heavy) > (5) Playwright trace (manual only).
    - Selected Approach: Option 1 — implement hook-level regression first, then optionally mirror at RTL scope.
    - Self-Critique: Hook test alone might not catch integration quirks; plan to sanity-check via RTL once stable.
  - Status Notes (2025-09-29): Hook-level regression operational; RTL follow-up queued if future regressions surface. *Strict Judge Review*: Coverage now fails when guard removed and passes with fix.
- [DONE] Update documentation/runbooks to describe the new hydration guard once verified.
  - Decision Log (2025-09-29):
    1. Append a "Hydration Race" appendix to the memory restore runbook with mitigation steps.
    2. Add troubleshooting FAQ entries to README.
    3. Produce a standalone incident postmortem referencing tests and code changes.
    4. Record a screencast walkthrough (deferred due to environment constraints).
    5. Update inline code comments only, leaving docs unchanged.
    - Ranking: (1) runbook appendix (most actionable) > (2) README FAQ > (3) postmortem > (5) comments only > (4) screencast.
    - Selected Approach: Option 1 — extend the runbook once fix is validated.
    - Self-Critique: Must ensure docs stay concise; will link to relevant tests to avoid duplication.
  - Status Notes (2025-09-29): Runbook appendix now covers the revision/local-write guard and references the new Vitest regression. *Strict Judge Review*: Documentation links to the exact test command and clarifies failure modes.
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
- [RETRYING] Implement the fix ensuring knowledge survives tab switches, uploads, and autonomous agent writes without regressions.
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
  - 2025-09-29 Reopen Note: Live manual testing still shows knowledge counts resetting to zero after leaving and re-entering the knowledge tab post-upload. Automated coverage passes, so the gap appears to stem from an unmodelled runtime condition (likely asynchronous unmount/cleanup). New acceptance criteria added below.
- [STARTED] Isolate why live uploads vanish after tab changes despite passing regressions.
  - Decision Log (2025-09-29):
    1. Capture a browser devtools performance profile while uploading and switching tabs to inspect React warnings about state updates on unmounted components.
    2. Add verbose logging (feature-flagged) around `CorpusUpload` lifecycle hooks to detect whether uploads finish after the component unmounts.
    3. Extend `app.knowledge-persistence.test.tsx` with a regression that imitates the user switching tabs *before* `FileReader` resolves to verify our current mocks cover the timing window.
    4. Build a lightweight Playwright smoke that uploads a large file and immediately navigates away/back to capture full fidelity.
    5. Instrument the persistence API (`savePersistedValue`) to record timestamps so we can compare write completion versus navigation.
  - Ranking: (3) test timing regression (fast, automatable) > (2) lifecycle logging (minimal code churn) > (1) performance profile (manual but high fidelity) > (5) persistence instrumentation (server touchpoint) > (4) Playwright (heavy infra).
  - Selected Approach: Option 3 — augment the existing RTL regression to simulate navigation before `FileReader` settles, confirming whether we miss the race in tests.
  - Self-Critique: The mocking required to pause `FileReader` may overfit to test harness behaviour; I will pair it with targeted logging to ensure we do not chase phantom races.
  - Status Notes (2025-09-29): Added `retains corpus uploads even when file processing completes after leaving the tab`, which manually defers the `FileReader` resolution until after navigation. The regression passes, signalling the live failure stems from a different condition (likely outside our current mocks). Next step: capture lifecycle logging to spot cleanup races.
  - Status Notes (2025-09-29, later): Instrumented `CorpusUpload` with mount/unmount diagnostics and guarded file-state updates so we can detect uploads finishing after the component unmounts. Vitest output now reports when knowledge writes happen post-unmount, confirming the timing window exists and giving us breadcrumbs for the root cause analysis.
  - Status Notes (2025-09-29 — Evening): Manual repro shows backend hydrations occasionally return empty arrays immediately after a successful upload. Pending shrinkage guard (`useKV` predicate) is expected to keep the richer mirror data while pushing a restorative write back to the server. Strict Judge check will rerun agentic operation tests once the guard lands.
  - Status Notes (2025-09-29 — Late Evening): Implemented the shrinkage guard and confirmed `useKV` rejects smaller server payloads while replaying the mirror state. Vitest suites (`tests/hooks/useKV.test.tsx`, `tests/components/app.knowledge-persistence.test.tsx`, `tests/components/screens.test.tsx`) all pass, covering both the guard and agentic operations.
- [NOT STARTED] Patch the root cause once identified, ensuring no knowledge loss across manual uploads, agent writes, and goal resets.
  - Acceptance: Live manual QA documented plus passing automated regressions covering the new timing scenario.
  - Follow-up: Update documentation/runbooks once the fix lands.
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


## Agent Execution Idle Regression (Single & Autonomous Runs)
- [RETRYING] Capture reproducible traces for the "idle" single-run/autonomous hang.
  - Decision Log (2025-09-29):
    1. Instrument `useAutonomousEngine` with status callbacks and mock providers inside a Vitest harness to observe stuck state.
    2. Add logging middleware around agent API calls in the dev server to inspect outbound requests/responses.
    3. Build a storybook-like sandbox that exercises single/autonomous runs with mock data for manual QA.
    4. Record a HAR trace from the UI while triggering both modes to inspect network stalls.
    5. Write an ADR summarizing suspected causes before coding (defer reproduction).
    - Ranking: (1) Vitest harness (deterministic, automatable) > (2) server middleware (useful but server-heavy) > (3) sandbox (time-consuming) > (4) HAR trace (manual) > (5) ADR first (premature).
    - Selected Approach: Option 1 — craft a regression test around `useAutonomousEngine` to surface the idle loop.
    - Self-Critique: Test scaffolding may require extensive mocking; ensure complexity doesn't delay fix cadence.
  - Status Notes (2025-09-29): Test plan drafted; mocks pending.
- [STARTED] Diagnose why `runSingleTurn`/`runContinuousLoop` resolve without producing derivations.
  - Decision Log (2025-09-29):
    1. Mock `generateAgentResponse` to resolve immediately and assert knowledge/derivation writes occur.
    2. Step through the real implementation with mock fetch responses to ensure provider configs propagate.
    3. Replace `generateAgentResponse` with a simplified synchronous generator to isolate concurrency issues.
    4. Add explicit `isRunning` guards that fail tests if loops exit unexpectedly.
    5. Instrument UI components with `console.error` on idle loops and rely on manual QA.
    - Ranking: (1) mock resolution (fast) > (2) step-through (accurate but slower) > (3) simplified generator (temporary) > (4) guard tests (supporting) > (5) manual logs.
    - Selected Approach: Option 1 — use deterministic mocks in tests to catch missing state updates.
    - Self-Critique: Must ensure mocks mirror actual API contract; will keep fallback tests referencing real logic where viable.
  - Status Notes (2025-09-29): Investigative mocks under construction.
- [NOT STARTED] Implement fix ensuring single/autonomous runs emit visible output and persist knowledge.
  - Decision Log (2025-09-29):
    1. Resolve promise chain in `processAgentTurn` to guarantee `setDerivationHistory`/`setKnowledgeBase` updates before status reset.
    2. Add awaitable queue so concurrent invocations cannot race.
    3. Split single-run and autonomous loops so `isRunning` semantics differ per mode.
    4. Introduce retry/backoff around provider calls with timeouts.
    5. Defer to UI-level guard that retries when no derivations were produced.
    - Ranking: (1) resolve promise chain (likely root cause) > (2) queue (heavy) > (4) retry/backoff (addresses network) > (3) loop split (structural) > (5) UI guard (symptom only).
    - Selected Approach: Option 1 — inspect asynchronous flow and ensure state writes occur before the run is marked idle.
    - Self-Critique: Need evidence before committing; ranking may change post-investigation.
  - Status Notes (2025-09-29): Awaiting investigation outcomes.
- [NOT STARTED] Backfill automated tests covering productive single and autonomous runs.
  - Decision Log (2025-09-29):
    1. Extend `useAutonomousEngine` tests with deterministic mocks verifying knowledge/derivation updates per turn.
    2. Add RTL test around `AgentCollaboration` toggling single vs. autonomous triggers.
    3. Provide a contract test for the underlying agent API stub.
    4. Add end-to-end Playwright smoke.
    5. Rely on manual QA only.
    - Ranking: (1) hook-level test > (2) RTL > (3) contract > (4) Playwright > (5) manual.
    - Selected Approach: Option 1 — start with hook-level coverage for determinism.
    - Self-Critique: Hook tests alone may miss UI wiring; will consider RTL once hook coverage passes.
  - Status Notes (2025-09-29): Blocked pending fix implementation.

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
  - Status Notes (2025-09-29): Added environment-variable overrides (`VITE_OLLAMA_BASE_URL`, `VITE_QDRANT_BASE_URL`) that seed provider defaults without manual UI input, reducing friction when hosting runtimes on separate machines.
- [NOT STARTED] Broaden automated coverage for Ollama/Qdrant settings persistence and validation logic beyond URL normalisation.
  - Acceptance: Component tests exercising form interactions and persistence writes.

---

## Additional Observability & Follow-ups
- [NOT STARTED] Assess whether the persistence API should expose differentiated error metadata (network vs 404 vs validation) to assist in diagnosing state drops.
  - Acceptance: Proposal or implementation notes outlining API adjustments and client handling.
