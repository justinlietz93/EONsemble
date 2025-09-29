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
