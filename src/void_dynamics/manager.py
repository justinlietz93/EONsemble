"""Void Dynamics Learning graph manager implementation."""
from __future__ import annotations

import math
from collections import deque
from os import PathLike
from random import Random
from typing import Any, Callable, Deque, Dict, Iterable, List, Optional, Sequence, Tuple

from .memory_state import MemoryState, clamp01
from .persistence import load_json as persistence_load_json
from .persistence import manager_to_dict, populate_manager_from_dict, save_json as persistence_save_json
from .territories import (
    assign_territory,
    estimate_novelty,
    maybe_diffuse,
    maybe_split_territory,
    normalize_embedding,
    record_member_distance,
    update_pair_metrics,
)
from .utils import clamp_float, maybe_lock, require_int, sanitize_config

CondenseCallback = Callable[[List[str]], Optional[Tuple[str, str]]]


class VoidMemoryManager:
    """Coordinator for the Void Dynamics Learning system."""

    _persistence_version = 1
    _reward_alpha = 0.05
    _territory_warmup = 1000

    def __init__(
        self,
        *,
        capacity: int,
        base_ttl: int,
        decay_half_life: int,
        prune_sample: int,
        prune_target_ratio: float,
        thread_safe: bool = False,
        seed: Optional[int] = None,
        recency_half_life_ticks: int = 64,
        habituation_start: int = 32,
        habituation_scale: float = 1.0,
        boredom_weight: float = 0.35,
        frontier_novelty_threshold: float = 0.8,
        frontier_patience: int = 3,
        diffusion_interval: int = 12,
        diffusion_kappa: float = 0.25,
        exploration_churn_window: int = 32,
        condensation_boredom: float = 0.85,
        condensation_conf: float = 0.6,
        condensation_mass: float = 5.0,
    ) -> None:
        self._capacity = require_int(capacity, minimum=10, name="capacity")
        self._base_ttl = require_int(base_ttl, minimum=10, name="base_ttl")
        self._decay_half_life = require_int(decay_half_life, minimum=1, name="decay_half_life")
        self._prune_sample = require_int(prune_sample, minimum=16, name="prune_sample")
        self._prune_target_ratio = clamp_float(prune_target_ratio, 0.05, 1.0)
        self._thread_safe = bool(thread_safe)
        self._lock: Optional[Any] = None
        if self._thread_safe:
            from threading import Lock

            self._lock = Lock()
        if seed is not None:
            seed = int(seed)
        self._rng = Random(seed)
        self._recency_half_life = require_int(recency_half_life_ticks, minimum=1, name="recency_half_life_ticks")
        self._habituation_start = require_int(habituation_start, minimum=0, name="habituation_start")
        self._habituation_scale = max(float(habituation_scale), 1.0)
        self._boredom_weight = clamp_float(boredom_weight, 0.0, 1.0)
        self._frontier_novelty_threshold = clamp_float(frontier_novelty_threshold, 0.0, 1.0)
        self._frontier_patience = require_int(frontier_patience, minimum=2, name="frontier_patience")
        self._diffusion_interval = require_int(diffusion_interval, minimum=5, name="diffusion_interval")
        self._diffusion_kappa = clamp_float(diffusion_kappa, 0.0, 1.0)
        self._exploration_churn_window = require_int(
            exploration_churn_window, minimum=10, name="exploration_churn_window"
        )
        self._condensation_boredom = clamp01(condensation_boredom)
        self._condensation_conf = clamp01(condensation_conf)
        self._condensation_mass = float(condensation_mass)

        self._mem: Dict[str, MemoryState] = {}
        self._tick = 0
        self._events: Deque[Dict[str, Any]] = deque(maxlen=1024)
        self._nn_distances: Deque[float] = deque(maxlen=5000)
        self._territory_centroids: Dict[int, List[float]] = {}
        self._territory_counts: Dict[int, int] = {}
        self._territory_member_dists: Dict[int, Deque[float]] = {}
        self._territory_tau = 0.3
        self._next_territory_id = 10_000
        self._deterministic_ids: Dict[str, int] = {}
        self._reward_ema = 0.0
        self._pair_churn: Dict[Tuple[int, int], Deque[int]] = {}
        self._pair_last: Dict[Tuple[int, int], int] = {}
        self._exploration_temp = 1.0
        self._pending_condense: List[str] = []
        self._condense_callback: Optional[CondenseCallback] = None
        self.engrams: Dict[str, List[str]] = {}
        self.frontier: Dict[str, Dict[str, Any]] = {}
        self._split_counter = 0
        self._merge_counter = 0

        self._config = {
            "capacity": self._capacity,
            "base_ttl": self._base_ttl,
            "decay_half_life": self._decay_half_life,
            "prune_sample": self._prune_sample,
            "prune_target_ratio": self._prune_target_ratio,
            "thread_safe": self._thread_safe,
            "seed": seed,
            "recency_half_life_ticks": self._recency_half_life,
            "habituation_start": self._habituation_start,
            "habituation_scale": self._habituation_scale,
            "boredom_weight": self._boredom_weight,
            "frontier_novelty_threshold": self._frontier_novelty_threshold,
            "frontier_patience": self._frontier_patience,
            "diffusion_interval": self._diffusion_interval,
            "diffusion_kappa": self._diffusion_kappa,
            "exploration_churn_window": self._exploration_churn_window,
            "condensation_boredom": self._condensation_boredom,
            "condensation_conf": self._condensation_conf,
            "condensation_mass": self._condensation_mass,
        }

    # ------------------------------------------------------------------
    # Public API

    def register_chunks(
        self,
        *,
        ids: Iterable[str],
        raw_texts: Iterable[str],
        embeddings: Optional[Iterable[Optional[Sequence[float]]]] = None,
        metadata: Optional[Iterable[Optional[Dict[str, Any]]]] = None,
    ) -> None:
        id_list = list(ids)
        text_list = list(raw_texts)
        if len(id_list) != len(text_list):
            raise ValueError("ids and raw_texts must be correlated pairwise")
        embedding_list: Optional[List[Optional[Sequence[float]]]] = None
        if embeddings is not None:
            embedding_list = list(embeddings)
            if len(embedding_list) != len(id_list):
                raise ValueError("embeddings length must match ids")
        metadata_list: Optional[List[Optional[Dict[str, Any]]]] = None
        if metadata is not None:
            metadata_list = list(metadata)
            if len(metadata_list) != len(id_list):
                raise ValueError("metadata length must match ids")

        added = False
        with maybe_lock(self._lock):
            for index, memory_id in enumerate(id_list):
                if memory_id in self._mem:
                    continue
                text = text_list[index]
                embedding = None
                if embedding_list is not None:
                    embedding = normalize_embedding(embedding_list[index]) if embedding_list[index] is not None else None
                meta = metadata_list[index] if metadata_list is not None else None
                self._register_memory(memory_id, text, embedding, meta)
                added = True
            if added:
                pending = self._flush_condensation_locked()
                self._after_operation()
        if added:
            self._run_condense_callback(pending)

    def reinforce(
        self,
        *,
        results: Dict[str, List[List[Any]]],
        heat_gain: float,
        ttl_boost: int,
    ) -> None:
        if "ids" not in results or "distances" not in results:
            raise ValueError("results must contain 'ids' and 'distances'")
        ids_rows = results["ids"]
        dist_rows = results["distances"]
        if len(ids_rows) != len(dist_rows):
            raise ValueError("ids and distances rows must align")
        with maybe_lock(self._lock):
            for ids_row, dist_row in zip(ids_rows, dist_rows):
                if len(ids_row) != len(dist_row):
                    raise ValueError("ids_row and dist_row must align")
                states: List[MemoryState] = []
                sims: List[float] = []
                for memory_id, distance in zip(ids_row, dist_row):
                    ms = self._mem.get(memory_id)
                    if ms is None:
                        continue
                    sim = max(0.0, 1.0 - float(distance))
                    states.append(ms)
                    sims.append(sim)
                if not states:
                    continue
                for ms in states:
                    ms.inhibition = min(ms.inhibition + 0.05, 1.0)
                update_pair_metrics(self, states)
                avg_sim = sum(sims) / len(sims)
                self._reward_ema = (1.0 - self._reward_alpha) * self._reward_ema + self._reward_alpha * avg_sim
                for ms, sim in zip(states, sims):
                    self._apply_reinforcement(ms, sim, heat_gain, ttl_boost)
                    if ms.novelty >= self._frontier_novelty_threshold and ms.boredom < 0.5:
                        ms.frontier_hits += 1
                        self.frontier[ms.memory_id] = {
                            "territory": ms.territory_id,
                            "hits": ms.frontier_hits,
                            "novelty": ms.novelty,
                        }
                        if ms.frontier_hits >= self._frontier_patience:
                            maybe_split_territory(self, ms)
                            ms.frontier_hits = 0
                    else:
                        ms.frontier_hits = 0
                        self.frontier.pop(ms.memory_id, None)
                    if (
                        ms.boredom >= self._condensation_boredom
                        and ms.confidence >= self._condensation_conf
                        and ms.mass >= self._condensation_mass
                    ):
                        if ms.memory_id not in self._pending_condense:
                            self._pending_condense.append(ms.memory_id)
                            ms.pending_condense = True
                self._record_event("reinforce", {"count": len(states)})
            pending = self._flush_condensation_locked()
            self._after_operation()
        self._run_condense_callback(pending)

    def degrade(self, *, ids: Iterable[str], ttl_floor: int) -> None:
        ttl_floor = require_int(ttl_floor, minimum=1, name="ttl_floor")
        with maybe_lock(self._lock):
            count = 0
            for memory_id in ids:
                ms = self._mem.get(memory_id)
                if ms is None:
                    continue
                ms.ttl = min(ms.ttl, ttl_floor)
                ms.boredom = min(1.0, ms.boredom + 0.1)
                ms.clamp_ranges()
                count += 1
            if count:
                self._record_event("degrade", {"count": count})

    def register_engram(self, *, summary_id: str, member_ids: Iterable[str], text: str) -> bool:
        members = [mid for mid in member_ids if mid in self._mem]
        if len(members) < 2:
            return False
        with maybe_lock(self._lock):
            self.engrams[summary_id] = members
            for mid in members:
                ms = self._mem[mid]
                ms.boredom = min(1.0, ms.boredom + 0.05)
                ms.inhibition = min(1.0, ms.inhibition + 0.05)
                ms.clamp_ranges()
            self._record_event("engram", {"id": summary_id, "members": len(members)})
        return True

    def top(self, k: int) -> List[Tuple[str, float]]:
        if k <= 0:
            k = 1
        if k > 100:
            k = 100
        with maybe_lock(self._lock):
            scored = [(mid, self.composite_score(ms)) for mid, ms in self._mem.items()]
        scored.sort(key=lambda item: item[1], reverse=True)
        return scored[:k]

    def composite_score(self, ms: MemoryState) -> float:
        dt = max(0, self._tick - ms.last_touch_tick)
        recency_hl = max(1, self._recency_half_life)
        recency = math.exp(-math.log(2.0) * dt / recency_hl)
        score = ms.confidence * (1.0 - self._boredom_weight) + ms.novelty * self._boredom_weight
        score += ms.heat * 0.1 + recency
        return max(0.0, score)

    def composite_score_for(self, memory_id: str) -> Optional[float]:
        ms = self._mem.get(memory_id)
        if ms is None:
            return None
        return self.composite_score(ms)

    def exploratory_weight(self, memory_id: str) -> float:
        ms = self._mem.get(memory_id)
        if ms is None:
            return 0.0
        return clamp01(ms.novelty * (1.0 - ms.boredom))

    def stats(self) -> Dict[str, float]:
        with maybe_lock(self._lock):
            if not self._mem:
                return {
                    "count": 0.0,
                    "avg_confidence": 0.0,
                    "avg_novelty": 0.0,
                    "avg_boredom": 0.0,
                    "avg_mass": 0.0,
                }
            count = float(len(self._mem))
            avg_conf = sum(ms.confidence for ms in self._mem.values()) / count
            avg_nov = sum(ms.novelty for ms in self._mem.values()) / count
            avg_bor = sum(ms.boredom for ms in self._mem.values()) / count
            avg_mass = sum(ms.mass for ms in self._mem.values()) / count
            return {
                "count": count,
                "avg_confidence": avg_conf,
                "avg_novelty": avg_nov,
                "avg_boredom": avg_bor,
                "avg_mass": avg_mass,
            }

    def consume_events(self) -> List[Dict[str, Any]]:
        with maybe_lock(self._lock):
            events = list(self._events)
            self._events.clear()
        return events

    def peek_events(self, limit: int) -> List[Dict[str, Any]]:
        if limit <= 0:
            return []
        with maybe_lock(self._lock):
            return list(self._events)[:limit]

    def set_condense_callback(self, callback: Optional[CondenseCallback]) -> None:
        with maybe_lock(self._lock):
            self._condense_callback = callback

    # ------------------------------------------------------------------
    # Persistence

    def to_dict(self) -> Dict[str, Any]:
        with maybe_lock(self._lock):
            return manager_to_dict(self)

    @classmethod
    def from_dict(cls, payload: Dict[str, Any]) -> "VoidMemoryManager":
        config = sanitize_config(payload.get("config", {}))
        manager = cls(**config)
        with maybe_lock(manager._lock):
            populate_manager_from_dict(manager, payload)
        return manager

    def save_json(self, path: str | bytes | PathLike[str]) -> bool:
        return persistence_save_json(self, path)

    @classmethod
    def load_json(cls, path: str | bytes | PathLike[str]) -> Optional["VoidMemoryManager"]:
        return persistence_load_json(cls, path)

    # ------------------------------------------------------------------
    # Internal helpers

    def _register_memory(
        self,
        memory_id: str,
        text: str,
        embedding: Optional[Sequence[float]],
        meta: Optional[Dict[str, Any]],
    ) -> None:
        territory_id = assign_territory(self, text=text, embedding=embedding)
        novelty = estimate_novelty(text)
        ttl = self._base_ttl
        state = MemoryState(
            memory_id=memory_id,
            text=text,
            embedding=list(embedding) if embedding is not None else None,
            metadata=meta,
            territory_id=territory_id,
            ttl=ttl,
            last_touch_tick=self._tick,
            confidence=0.35,
            novelty=novelty,
            boredom=0.0,
            mass=1.0,
            heat=0.0,
        )
        state.clamp_ranges()
        self._mem[memory_id] = state
        self._territory_counts[territory_id] = self._territory_counts.get(territory_id, 0) + 1
        if territory_id not in self._territory_member_dists:
            self._territory_member_dists[territory_id] = deque(maxlen=1024)
        self._record_event("register", {"id": memory_id, "territory": territory_id})

    def _apply_reinforcement(self, ms: MemoryState, sim: float, heat_gain: float, ttl_boost: int) -> None:
        ttl_boost = max(ttl_boost, 0)
        ms.last_touch_tick = self._tick
        ms.use_count += 1
        ms.heat += heat_gain
        ms.mass += sim * (1.0 + heat_gain)
        boredom_gain = self._boredom_increment(ms)
        ms.boredom = clamp01(ms.boredom + boredom_gain)
        ms.confidence = clamp01(ms.confidence + (1.0 - ms.confidence) * sim * 0.3)
        ms.novelty = clamp01(ms.novelty * 0.9 + (1.0 - sim) * 0.1)
        ms.ttl = max(ms.ttl, ttl_boost)
        ms.clamp_ranges()
        record_member_distance(self, ms, sim)

    def _boredom_increment(self, ms: MemoryState) -> float:
        if ms.use_count <= self._habituation_start:
            return 0.02
        denominator = max(self._habituation_scale, float(ms.use_count))
        return min(0.2, float(ms.use_count) / denominator * 0.05)

    def _after_operation(self) -> None:
        self._tick += 1
        self._decay_pass()
        self._prune_if_needed()
        maybe_diffuse(self)
        self._exploration_temp = min(self._exploration_temp, 1.0)

    def _decay_pass(self) -> None:
        decay_factor = 0.5 ** (1.0 / self._decay_half_life)
        to_remove: List[str] = []
        for memory_id, ms in self._mem.items():
            ms.heat *= decay_factor
            ms.ttl = max(0, ms.ttl - 1)
            ms.inhibition *= 0.98
            ms.clamp_ranges()
            if ms.ttl <= 0 and ms.confidence < 0.05 and ms.mass < 3.0:
                to_remove.append(memory_id)
        for memory_id in to_remove:
            self._remove_memory(memory_id)

    def _remove_memory(self, memory_id: str) -> None:
        ms = self._mem.pop(memory_id, None)
        if ms is None:
            return
        if ms.territory_id is not None:
            count = self._territory_counts.get(ms.territory_id, 0) - 1
            if count <= 0:
                self._territory_counts.pop(ms.territory_id, None)
                self._territory_centroids.pop(ms.territory_id, None)
                self._territory_member_dists.pop(ms.territory_id, None)
            else:
                self._territory_counts[ms.territory_id] = count
        self._record_event("evict", {"id": memory_id})

    def _prune_if_needed(self) -> None:
        size = len(self._mem)
        if size <= self._capacity:
            return
        ratio = clamp_float(self._prune_target_ratio, 0.05, 0.95)
        target_drop = max(1, min(size - self._capacity, int(max(1.0, size * ratio - self._capacity))))
        candidates = list(self._mem.keys())
        self._rng.shuffle(candidates)
        candidates = candidates[: min(len(candidates), self._prune_sample)]
        scored = sorted(candidates, key=lambda mid: self.composite_score(self._mem[mid]))
        for memory_id in scored[:target_drop]:
            self._remove_memory(memory_id)
        self._record_event("prune", {"count": target_drop})

    def _record_event(self, event_type: str, payload: Dict[str, Any]) -> None:
        data = dict(payload)
        data["type"] = event_type
        data["tick"] = self._tick
        self._events.append(data)

    def _flush_condensation_locked(self) -> List[Tuple[str, str]]:
        if not self._pending_condense:
            return []
        pairs: List[Tuple[str, str]] = []
        for memory_id in self._pending_condense:
            ms = self._mem.get(memory_id)
            if ms is not None:
                pairs.append((memory_id, ms.text))
                ms.pending_condense = False
        self._pending_condense.clear()
        return pairs

    def _run_condense_callback(self, pending: List[Tuple[str, str]]) -> None:
        if not pending or self._condense_callback is None:
            return
        texts = [text for _, text in pending]
        summary = self._condense_callback(texts)
        if summary is None:
            return
        summary_id, text = summary
        self.register_chunks(ids=[summary_id], raw_texts=[text])


__all__ = ["VoidMemoryManager", "CondenseCallback"]
