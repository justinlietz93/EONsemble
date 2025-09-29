"""Utility helpers for the Void Dynamics Learning system."""
from __future__ import annotations

from contextlib import contextmanager
from threading import Lock
from typing import Any, Dict, Iterator, Optional


@contextmanager
def maybe_lock(lock: Optional[Lock]) -> Iterator[None]:
    """Acquire a lock when provided, acting as a no-op otherwise."""
    if lock is None:
        yield
        return
    lock.acquire()
    try:
        yield
    finally:
        lock.release()


def require_int(value: Any, *, minimum: int, name: str) -> int:
    """Cast *value* to an integer, enforcing a minimum."""
    try:
        cast_value = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{name} must be an integer") from exc
    if cast_value < minimum:
        raise ValueError(f"{name} must be >= {minimum}")
    return cast_value


def clamp_float(value: float, lower: float, upper: float) -> float:
    """Clamp a floating point value to the inclusive range [lower, upper]."""
    value = float(value)
    if value < lower:
        return lower
    if value > upper:
        return upper
    return value


def sanitize_config(config: Dict[str, Any]) -> Dict[str, Any]:
    """Merge persisted configuration with defaults."""
    defaults = {
        "capacity": 256,
        "base_ttl": 128,
        "decay_half_life": 32,
        "prune_sample": 64,
        "prune_target_ratio": 0.2,
        "thread_safe": False,
        "seed": None,
        "recency_half_life_ticks": 64,
        "habituation_start": 32,
        "habituation_scale": 1.0,
        "boredom_weight": 0.35,
        "frontier_novelty_threshold": 0.8,
        "frontier_patience": 3,
        "diffusion_interval": 12,
        "diffusion_kappa": 0.25,
        "exploration_churn_window": 32,
        "condensation_boredom": 0.85,
        "condensation_conf": 0.6,
        "condensation_mass": 5.0,
    }
    merged = dict(defaults)
    merged.update(config)
    return merged


__all__ = ["maybe_lock", "require_int", "clamp_float", "sanitize_config"]
