# TODO Checklist

## Knowledge Persistence Audit
- [DONE] Review current knowledge persistence flow (frontend `useKV` hook and server persistence API) to pinpoint why knowledge entries disappear when navigating tabs.
  - Initial inspection reveals `useKV` re-runs its persistence hydration effect on every render because the `defaultValue` dependency is an unstable array literal. When the persistence service is offline (fetch errors), the hook overwrites local state with the default `[]`, wiping knowledge entries during tab switches that trigger re-renders.
- [DONE] Design and implement fixes ensuring in-memory state is stable even when the persistence service is unavailable.
  - Implemented ref-backed default handling and conditional hydration in `useKV` to prevent failed fetches from clobbering populated local caches, preserving knowledge entries during UI navigation even without the persistence backend.
- [DONE] Add regression coverage verifying knowledge entries remain after state updates without a persistence backend.
  - Added `tests/hooks/useKV.test.tsx` which simulates a delayed persistence response returning `undefined` and confirms local updates remain intact, along with hydration coverage for successful fetches.
- [DONE] Document the persistence behaviour and testing steps for future contributors.
  - Extended `docs/runbooks/memory-restore.md` with an appendix summarizing the new `useKV` offline fallback semantics and the `npx vitest run tests/hooks/useKV.test.tsx` regression command.

## Broader System Review
- [DONE] Identify any additional blockers or architectural risks discovered during persistence work and log actionable follow-ups.
  - Logged a follow-up to split network errors from `404` misses in the persistence API so the UI can warn users about outage states instead of silently falling back to defaults.
