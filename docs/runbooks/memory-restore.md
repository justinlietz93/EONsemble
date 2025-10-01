# Memory Persistence Restore Runbook

This runbook describes the procedure for restoring collaborative memory after a
catastrophic outage. It covers snapshot validation, Void Dynamics
re-initialization, and collaboration history replay.

## 1. Preconditions
- Latest persistence snapshot (`.json`) exported by scheduled backups.
- Collaboration event log exported from the application (goal transcript +
  knowledge entries).
- Access to the deployment storage bucket or volume where snapshots reside.
- Maintenance window announced to collaborators.

## 2. Validate Snapshot Integrity
1. Download the most recent snapshot to a staging environment.
2. Run `python -m json.tool path/to/snapshot.json` to confirm the file is valid
   JSON.
3. Use `python scripts/nightly_telemetry.py --snapshot path/to/snapshot.json \
   --iterations 4 --output /tmp/restore-dry-run.json` to ensure the manager can
   load and process the state without errors.
4. Inspect `/tmp/restore-dry-run.json` for unexpected zero counts or reward EMA
   drops; abort if anomalies appear.

## 3. Prepare the Target Deployment
1. Stop all autonomous runs and disable new collaboration requests.
2. Rotate the backing persistence storage (create a copy of the current, possibly
   corrupted, state for forensic review).
3. Clear the cache or key-value entries that point to the old memory identifiers.

## 4. Restore Memory State
1. Upload the validated snapshot to the deployment storage location.
2. Issue the restore command within the application host:
   ```bash
   python - <<'PY'
   from src.void_dynamics.manager import VoidMemoryManager

   restored = VoidMemoryManager.load_json("/path/to/snapshot.json")
   if restored is None:
       raise SystemExit("failed to load snapshot")
   restored.save_json("/deploy/runtime/void-memory.json")
   PY
   ```
3. Point the application configuration to `/deploy/runtime/void-memory.json` or
   the equivalent restore path.

## 5. Replay Collaboration History
1. Import the collaboration transcript into the queue used for knowledge
   ingestion.
2. Re-run the collaboration ingestion routine to rebuild derived structures
   (vector cache, graph indices) while the restored `VoidMemoryManager` provides
   persistence semantics.
3. Use the telemetry script with `--snapshot` to run a post-restore probe and
   confirm reward EMA and heat levels match expectations.

## 6. Post-Restore Validation
- Launch a supervised autonomous cycle to ensure the agents can retrieve
  restored knowledge without errors.
- Verify the `reports/void-telemetry-latest.md` summary produced by the nightly
  job shows stable heat decay and no abnormal territory churn.
- Update `CHECKLIST.md` with the restoration time and any corrective actions.

## 7. Communication
- Notify collaborators that restoration has completed and the system is
  accepting requests.
- Attach the telemetry report, replay logs, and snapshot hash to the incident
  ticket for auditing.

## 8. Preventive Follow-Ups
- Schedule an additional snapshot immediately after recovery.
- Review monitoring alerts to ensure outages are detected quickly.
- Rehearse this runbook quarterly using the automated drill:
  - GitHub Actions workflow `quarterly-disaster-drill.yml` runs the drill on the
    first day of every third month.
  - The workflow executes `scripts/disaster_recovery_drill.py`, which loads the
    latest snapshot (or seeded baseline), replays the telemetry probe, persists
    a post-drill snapshot, and uploads Markdown/JSON artifacts to
    `reports/drills/` for auditing.
  - Review `reports/drills/history.jsonl` to track previous drill outcomes and
    ensure anomalies are investigated promptly.

## Appendix A – Frontend Persistence Notes

- The React `useKV` hook now keeps an in-memory cache authoritative whenever the
  persistence API is unreachable. Failed hydration attempts no longer overwrite
  populated knowledge arrays; the hook only falls back to defaults when no
  memory is present.
- Beginning 2025-09-29, `useKV` also mirrors each write into
  `window.localStorage` under the `eon.kv.<key>` namespace. On reload the mirror
  seeds the in-memory store before server hydration, ensuring knowledge remains
  visible even if persistence fetches fail. Mirror entries are cleared by
  `clearKVStore()` and are subject to the browser's ~5–10 MB quota; large corpus
  uploads should therefore be chunked conservatively.
- The mirror now stores sync metadata (`lastUpdatedAt`, `lastSyncedAt`) so the
  hook can detect unsynchronised writes. If hydration returns an empty payload
  while the mirror reports pending changes, `useKV` skips the server data,
  replays the mirror payload back to the persistence API, and keeps the UI in
  sync. Inspect `tests/hooks/useKV.test.tsx` (`keeps mirrored values when pending
  sync metadata exists...`) or `tests/components/app.knowledge-sync.test.tsx` for
  regression coverage.
- When investigating suspected regressions, reproduce the offline scenario by
  mocking `fetchPersistedValue` to resolve `undefined` and verify that
  previously added entries remain visible.
- Run `npx vitest run tests/hooks/useKV.test.tsx` to execute the dedicated hook
  regression suite that covers both the offline fallback and successful server
  hydration flows.
- If the persistence API hydrates `null` for a key whose default is non-null,
  `useKV` now emits a warning and restores the configured fallback. Validate the
  frontend behaviour with `npx vitest run tests/components/app.knowledge-persistence.test.tsx`,
  which includes a regression covering the null-hydration scenario.
- Knowledge setters (`setKnowledgeBase`, `setDerivationHistory`, etc.) must now
  receive the `useKV` dispatcher directly. Components append entries via
  functional updates (`prev => [...prev, entry]`) to avoid stale-closure races
  when uploads complete while navigation occurs. The corpus upload guard within
  `tests/components/app.knowledge-persistence.test.tsx` exercises this path by
  uploading, tab-hopping immediately, and verifying both the persisted payload
  and UI state remain intact.
- Hydration races are prevented via per-key revision counters and a local-write
  flag inside `useKV`. If the persistence API returns stale data after a user
  mutation, the hook discards the payload instead of overwriting memory. The
  regression `drops stale persisted values when hydration resolves after a newer
  local update` (run with `npx vitest run tests/hooks/useKV.test.tsx`) fails if
  the guard is removed.
- Validate mirror hydration by running
  `npx vitest run tests/components/app.knowledge-persistence.test.tsx -t "browser mirror"`,
  which unmounts the app, clears the in-memory cache, and confirms the
  `localStorage` mirror repopulates knowledge entries while the persistence API
  stays offline. To verify the metadata guard against stale hydration, execute
  `npx vitest run tests/components/app.knowledge-sync.test.tsx`.
- Session reset diagnostics can be enabled via
  `window.localStorage.setItem('eon.debugSessionTrace', 'true')`. The enhanced
  `useSessionDiagnostics` hook logs mounts, unmounts, and unexpected tab resets
  together with the active goal ID and a sampled knowledge payload. Exercise the
  behaviour with `npx vitest run tests/hooks/useSessionDiagnostics.test.tsx` to
  confirm logging stays consistent.
