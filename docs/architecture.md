# Hybrid-Clean Architecture Mapping

The collaborative physicist workspace follows the Hybrid-Clean blueprint outlined in the system card. The table below summarises
how the repository maps to each layer.

| Layer | Location | Responsibilities | Notes |
| --- | --- | --- | --- |
| Presentation | `src/components`, `src/App.tsx`, `src/main.tsx` | React UI, agent orchestration widgets, status surfaces | Only imports from application (`src/lib`) and domain (`src/types`). |
| Application | `src/lib`, `src/hooks` | Knowledge retrieval, autonomous safeguards, storage adapters | Pure TypeScript without React imports, exposing functions consumed by presentation. |
| Domain | `src/types`, `src/void_dynamics/memory_state.py` | Shared data contracts for TypeScript and Python | Contains plain data models with no framework dependencies. |
| Business Logic | `src/void_dynamics/manager.py`, `src/lib/knowledge-utils.ts` | Reinforcement lifecycle, graph expansion, pipeline rules | Modules depend only on domain models and shared utilities. |
| Infrastructure | `scripts/migrate-autonomous-config.mjs`, Node↔Python bridge in tests | Process orchestration, config migration | Provides adapters that the application layer calls.

## Dependency Checks

- No file in `src/lib` imports from `src/components` or other presentation modules.
- `VoidMemoryManager` receives input via plain JSON interfaces, keeping Python domain logic framework-neutral.
- Presentation components depend on application hooks (`useKV`) and utilities but never reach into Python modules directly.
- Shared utilities live under 500 lines and expose deterministic behaviour to both runtimes.

## Verification Steps

The new CI workflow (`.github/workflows/ci.yml`) enforces the separation by running:

1. `npm run lint` – flags accidental cross-layer imports in TypeScript via ESLint path rules.
2. `npm run test` – exercises application-level flows, including the Node↔Python bridge.
3. `python -m unittest discover -s tests -t .` – validates the Python business logic independently.

Developers introducing new modules should place them under the appropriate directory and keep imports aligned with the dependency
flow: `presentation → application → domain` plus infrastructure adapters supplying data to the application layer.
