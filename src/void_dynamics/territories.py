"""Territory management helpers for the Void Dynamics Learning system."""
from __future__ import annotations

import math
from collections import deque
from hashlib import blake2b
from itertools import combinations
from statistics import median
from typing import Any, Deque, Dict, Iterable, List, Optional, Sequence, Tuple

from .memory_state import MemoryState, clamp01
from .utils import clamp_float


def assign_territory(manager: "TerritoryManager", *, text: str, embedding: Optional[Sequence[float]]) -> int:
    if embedding is None:
        return deterministic_territory(manager, text)
    vector = normalize_embedding(embedding)
    if not manager._territory_centroids or warmup_active(manager):
        return create_territory(manager, vector, text)
    best_tid: Optional[int] = None
    best_distance: Optional[float] = None
    for tid, centroid in manager._territory_centroids.items():
        distance = cosine_distance(vector, centroid)
        if best_distance is None or distance < best_distance:
            best_distance = distance
            best_tid = tid
    if best_tid is None or best_distance is None:
        return create_territory(manager, vector, text)
    record_nn_distance(manager, best_distance)
    if best_distance <= manager._territory_tau:
        update_centroid(manager, best_tid, vector)
        return best_tid
    return create_territory(manager, vector, text)


def warmup_active(manager: "TerritoryManager") -> bool:
    return len(manager._nn_distances) < manager._territory_warmup and len(manager._territory_centroids) < 50


def create_territory(manager: "TerritoryManager", embedding: Sequence[float], text: str) -> int:
    tid = manager._next_territory_id
    manager._next_territory_id += 1
    manager._territory_centroids[tid] = normalize_embedding(embedding)
    manager._territory_counts[tid] = 0
    manager._territory_member_dists[tid] = deque(maxlen=1024)
    deterministic_id = hash_text(text)
    if deterministic_id not in manager._deterministic_ids:
        manager._deterministic_ids[deterministic_id] = tid
    manager._record_event("territory_create", {"id": tid})
    return tid


def deterministic_territory(manager: "TerritoryManager", text: str) -> int:
    deterministic_id = hash_text(text)
    tid = manager._deterministic_ids.get(deterministic_id)
    if tid is not None:
        return tid
    tid = manager._next_territory_id
    manager._next_territory_id += 1
    manager._territory_counts[tid] = 0
    manager._territory_member_dists[tid] = deque(maxlen=1024)
    manager._deterministic_ids[deterministic_id] = tid
    manager._record_event("territory_create", {"id": tid})
    return tid


def hash_text(text: str) -> str:
    try:
        return blake2b(text.encode("utf-8"), digest_size=16).hexdigest()
    except Exception:
        return str(abs(hash(text)))


def update_centroid(manager: "TerritoryManager", tid: int, embedding: Sequence[float]) -> None:
    centroid = manager._territory_centroids.get(tid)
    if centroid is None:
        manager._territory_centroids[tid] = normalize_embedding(embedding)
        return
    count = max(1, manager._territory_counts.get(tid, 1))
    updated = [(c * count + e) / (count + 1) for c, e in zip(centroid, embedding)]
    manager._territory_centroids[tid] = normalize_embedding(updated)


def record_nn_distance(manager: "TerritoryManager", distance: float) -> None:
    manager._nn_distances.append(float(distance))
    if manager._nn_distances:
        manager._territory_tau = clamp_float(median(manager._nn_distances), 0.05, 0.6)


def normalize_embedding(embedding: Sequence[float]) -> List[float]:
    vector = [float(x) for x in embedding]
    norm = math.sqrt(sum(v * v for v in vector))
    if norm == 0.0:
        return vector
    return [v / norm for v in vector]


def cosine_distance(a: Sequence[float], b: Sequence[float]) -> float:
    if not a or not b or len(a) != len(b):
        raise ValueError("cosine distance requires non-empty vectors of the same length")
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 1.0
    cosine = max(-1.0, min(1.0, dot / (norm_a * norm_b)))
    return 1.0 - cosine


def maybe_diffuse(manager: "TerritoryManager") -> None:
    if manager._diffusion_interval <= 0:
        return
    if manager._tick % manager._diffusion_interval != 0:
        return
    territories = list(manager._territory_centroids.keys())
    for a, b in combinations(territories, 2):
        if a == b:
            continue
        centroid_a = manager._territory_centroids.get(a)
        centroid_b = manager._territory_centroids.get(b)
        if centroid_a is None or centroid_b is None:
            continue
        distance = cosine_distance(centroid_a, centroid_b)
        tau = min(manager._territory_tau, 0.6)
        max_radius = max(territory_radius(manager, a), territory_radius(manager, b))
        if distance <= 0.5 * manager._territory_tau and max_radius <= 1.25 * tau:
            combined = manager._territory_counts.get(a, 0) + manager._territory_counts.get(b, 0)
            if combined >= 500:
                continue
            if manager._diffusion_kappa < manager._rng.random():
                continue
            count_a = manager._territory_counts.get(a, 0)
            count_b = manager._territory_counts.get(b, 0)
            if count_a <= count_b:
                merge_territories(manager, from_tid=a, to_tid=b)
            else:
                merge_territories(manager, from_tid=b, to_tid=a)
            break


def territory_radius(manager: "TerritoryManager", tid: int) -> float:
    dists = manager._territory_member_dists.get(tid)
    if not dists:
        return 0.0
    return max(dists)


def merge_territories(manager: "TerritoryManager", *, from_tid: int, to_tid: int) -> None:
    if from_tid == to_tid:
        return
    centroid_a = manager._territory_centroids.get(from_tid)
    centroid_b = manager._territory_centroids.get(to_tid)
    if centroid_a is None or centroid_b is None:
        return
    count_a = manager._territory_counts.get(from_tid, 0)
    count_b = manager._territory_counts.get(to_tid, 0)
    if count_a + count_b > 1000:
        return
    blended = [
        (ca * count_a + cb * count_b) / max(1, count_a + count_b)
        for ca, cb in zip(centroid_a, centroid_b)
    ]
    manager._territory_centroids[to_tid] = normalize_embedding(blended)
    merged_dists = deque(maxlen=1024)
    merged_dists.extend(manager._territory_member_dists.get(to_tid, []))
    merged_dists.extend(manager._territory_member_dists.get(from_tid, []))
    manager._territory_member_dists[to_tid] = merged_dists
    manager._territory_member_dists.pop(from_tid, None)
    for ms in manager._mem.values():
        if ms.territory_id == from_tid:
            ms.territory_id = to_tid
    manager._territory_counts[to_tid] = count_a + count_b
    manager._territory_counts.pop(from_tid, None)
    manager._territory_centroids.pop(from_tid, None)
    manager._merge_counter += 1
    manager._record_event("territory_merge", {"from": from_tid, "to": to_tid})


def maybe_split_territory(manager: "TerritoryManager", ms: MemoryState) -> None:
    tid = ms.territory_id
    if tid is None:
        return
    members = [state for state in manager._mem.values() if state.territory_id == tid]
    if len(members) < 6:
        return
    novelties = sorted(state.novelty for state in members)
    median_novelty = novelties[len(novelties) // 2]
    candidates = [state for state in members if state.novelty > median_novelty and state.boredom < 0.7]
    if len(candidates) < 2 or len(candidates) == len(members):
        return
    seed_embedding = candidates[0].embedding or []
    new_tid = create_territory(manager, seed_embedding, ms.text)
    centroid_sum: Optional[List[float]] = None
    new_count = 0
    for state in candidates:
        state.territory_id = new_tid
        if state.embedding:
            if centroid_sum is None:
                centroid_sum = [0.0] * len(state.embedding)
            centroid_sum = [a + b for a, b in zip(centroid_sum, state.embedding)]
        new_count += 1
    if centroid_sum:
        averaged = [value / max(1, new_count) for value in centroid_sum]
        manager._territory_centroids[new_tid] = normalize_embedding(averaged)
    manager._territory_counts[new_tid] = new_count
    manager._territory_counts[tid] = max(0, manager._territory_counts.get(tid, len(members)) - new_count)
    manager._split_counter += 1
    manager._record_event("territory_split", {"from": tid, "to": new_tid, "count": new_count})


def record_member_distance(manager: "TerritoryManager", ms: MemoryState, sim: float) -> None:
    if ms.embedding is None or ms.territory_id is None:
        return
    centroid = manager._territory_centroids.get(ms.territory_id)
    if centroid is None:
        return
    distance = max(0.0, 1.0 - sim)
    manager._territory_member_dists[ms.territory_id].append(distance)
    record_nn_distance(manager, distance)


def update_pair_metrics(manager: "TerritoryManager", states: Iterable[MemoryState]) -> None:
    ids = [state.territory_id for state in states if state.territory_id is not None]
    for a, b in combinations(ids, 2):
        pair = (min(a, b), max(a, b))
        dq = manager._pair_churn.get(pair)
        if dq is None:
            dq = deque(maxlen=manager._exploration_churn_window)
            manager._pair_churn[pair] = dq
        dq.append(manager._tick)
        manager._pair_last[pair] = manager._tick


def estimate_novelty(text: str) -> float:
    if not text:
        return 0.0
    diversity = len(set(text)) / 64.0
    return clamp01(diversity)


class TerritoryManager:
    """Protocol-style documentation class for typing assistance."""

    _territory_warmup: int
    _territory_centroids: Dict[int, List[float]]  # type: ignore[assignment]
    _territory_counts: Dict[int, int]  # type: ignore[assignment]
    _territory_member_dists: Dict[int, Deque[float]]
    _deterministic_ids: Dict[str, int]
    _nn_distances: Deque[float]
    _territory_tau: float
    _next_territory_id: int
    _diffusion_interval: int
    _diffusion_kappa: float
    _rng: any  # noqa: ANN401 - runtime attribute
    _mem: Dict[str, MemoryState]  # type: ignore[assignment]
    _merge_counter: int
    _split_counter: int
    _pair_churn: Dict[Tuple[int, int], Deque[int]]
    _pair_last: Dict[Tuple[int, int], int]
    _exploration_churn_window: int
    _tick: int

    def _record_event(self, event_type: str, payload: Dict[str, Any]) -> None:  # noqa: ANN401
        raise NotImplementedError


__all__ = [
    "assign_territory",
    "create_territory",
    "deterministic_territory",
    "maybe_diffuse",
    "maybe_split_territory",
    "merge_territories",
    "normalize_embedding",
    "record_member_distance",
    "update_centroid",
    "update_pair_metrics",
    "estimate_novelty",
]
