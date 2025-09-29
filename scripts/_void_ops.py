"""Shared helpers for Void Dynamics operational scripts."""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Iterable, Optional, Sequence, Tuple

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.void_dynamics.manager import VoidMemoryManager

# Seed knowledge used when telemetry scripts run without an existing snapshot.
SEED_MEMORY: Sequence[Tuple[str, str]] = (
    (
        "telemetry-alpha",
        "Baseline trace describing vacuum resonance calibration and reward decay.",
    ),
    (
        "telemetry-beta",
        "Queue management protocol for asynchronous reinforcement batches.",
    ),
    (
        "telemetry-gamma",
        "Centroid drift notebook logging territory churn thresholds and splits.",
    ),
    (
        "telemetry-delta",
        "Condensation heuristics for semantic clustering during focus recovery.",
    ),
)


def load_manager(snapshot: Optional[Path]) -> VoidMemoryManager:
    """Load a manager snapshot or return a configured fresh instance."""

    if snapshot is not None:
        loaded = VoidMemoryManager.load_json(str(snapshot))
        if loaded is not None:
            return loaded
    return VoidMemoryManager(
        capacity=64,
        base_ttl=120,
        decay_half_life=16,
        prune_sample=32,
        prune_target_ratio=0.25,
        seed=19,
        diffusion_interval=12,
        condensation_boredom=0.25,
        condensation_conf=0.4,
        condensation_mass=1.5,
    )


def bootstrap_memory(
    manager: VoidMemoryManager,
    seed_memory: Iterable[Tuple[str, str]] = SEED_MEMORY,
) -> None:
    """Ensure the manager has baseline memories available for probes."""

    stats = manager.stats()
    if stats["count"] > 0:
        return
    ids, texts = zip(*seed_memory)
    manager.register_chunks(ids=ids, raw_texts=texts)


__all__ = ["SEED_MEMORY", "load_manager", "bootstrap_memory"]
