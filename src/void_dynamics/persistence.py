"""Persistence helpers for the Void Dynamics Learning system."""
from __future__ import annotations

import json
import os
from collections import deque
from typing import Any, Deque, Dict, Optional

from .memory_state import MemoryState
from .utils import clamp_float, sanitize_config


def manager_to_dict(manager: "PersistentManager") -> Dict[str, Any]:
    mem_dict = {mid: ms.to_dict() for mid, ms in manager._mem.items()}
    territory_member_dists = {str(tid): list(dists) for tid, dists in manager._territory_member_dists.items()}
    pair_churn = {f"{a}:{b}": list(vals) for (a, b), vals in manager._pair_churn.items()}
    pair_last = {f"{a}:{b}": val for (a, b), val in manager._pair_last.items()}
    return {
        "version": manager._persistence_version,
        "tick": manager._tick,
        "mem": mem_dict,
        "engrams": manager.engrams,
        "frontier": manager.frontier,
        "next_territory": manager._next_territory_id,
        "reward_ema": manager._reward_ema,
        "pair_churn": pair_churn,
        "pair_last": pair_last,
        "territory_centroids": {str(k): v for k, v in manager._territory_centroids.items()},
        "territory_counts": {str(k): v for k, v in manager._territory_counts.items()},
        "territory_member_dists": territory_member_dists,
        "nn_distances": list(manager._nn_distances),
        "territory_tau": manager._territory_tau,
        "split_counter": manager._split_counter,
        "merge_counter": manager._merge_counter,
        "config": manager._config,
    }


def populate_manager_from_dict(manager: "PersistentManager", payload: Dict[str, Any]) -> "PersistentManager":
    manager._tick = int(payload.get("tick", 0))
    manager._next_territory_id = int(payload.get("next_territory", 10_000))
    manager._reward_ema = float(payload.get("reward_ema", 0.0))
    manager._territory_tau = clamp_float(float(payload.get("territory_tau", 0.3)), 0.05, 0.6)
    manager._split_counter = int(payload.get("split_counter", 0))
    manager._merge_counter = int(payload.get("merge_counter", 0))
    manager.engrams = {}
    for key, members in payload.get("engrams", {}).items():
        if isinstance(members, list):
            manager.engrams[key] = [str(mid) for mid in members]
    manager.frontier = {}
    for mid, info in payload.get("frontier", {}).items():
        if isinstance(info, dict):
            manager.frontier[str(mid)] = dict(info)
    mem_payload = payload.get("mem", {})
    if isinstance(mem_payload, dict):
        for mid, data in mem_payload.items():
            try:
                state = MemoryState.from_dict(str(mid), data)
            except Exception:
                continue
            manager._mem[state.memory_id] = state
    for tid_str, centroid in payload.get("territory_centroids", {}).items():
        try:
            tid = int(tid_str)
            manager._territory_centroids[tid] = [float(x) for x in centroid]
        except (TypeError, ValueError):
            continue
    for tid_str, count in payload.get("territory_counts", {}).items():
        try:
            tid = int(tid_str)
            manager._territory_counts[tid] = int(count)
        except (TypeError, ValueError):
            continue
    for tid_str, dists in payload.get("territory_member_dists", {}).items():
        try:
            tid = int(tid_str)
            dq = deque(maxlen=1024)
            for val in dists:
                dq.append(float(val))
            manager._territory_member_dists[tid] = dq
        except (TypeError, ValueError):
            continue
    manager._nn_distances.clear()
    nn_payload = payload.get("nn_distances", [])
    if isinstance(nn_payload, list):
        for val in nn_payload:
            try:
                manager._nn_distances.append(float(val))
            except (TypeError, ValueError):
                continue
    for key, values in payload.get("pair_churn", {}).items():
        try:
            a_str, b_str = str(key).split(":", 1)
            pair = tuple(sorted((int(a_str), int(b_str))))
            dq = deque(maxlen=manager._exploration_churn_window)
            for tick in values:
                dq.append(int(tick))
            manager._pair_churn[pair] = dq
        except (ValueError, TypeError):
            continue
    for key, value in payload.get("pair_last", {}).items():
        try:
            a_str, b_str = str(key).split(":", 1)
            pair = tuple(sorted((int(a_str), int(b_str))))
            manager._pair_last[pair] = int(value)
        except (ValueError, TypeError):
            continue
    return manager


def save_json(manager: "PersistentManager", path: os.PathLike[str] | str) -> bool:
    try:
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(manager_to_dict(manager), handle, ensure_ascii=False, indent=2)
        return True
    except OSError:
        return False


def load_json(cls, path: os.PathLike[str] | str) -> Optional["PersistentManager"]:
    try:
        with open(path, "r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return None
    config = sanitize_config(payload.get("config", {}))
    manager = cls(**config)
    try:
        return populate_manager_from_dict(manager, payload)
    except Exception:
        return None


class PersistentManager:
    """Protocol-style documentation class for typing assistance."""

    _persistence_version: int
    _tick: int
    _mem: Dict[str, MemoryState]
    _territory_member_dists: Dict[int, Deque[float]]
    _pair_churn: Dict[Any, Deque[int]]
    _pair_last: Dict[Any, int]
    _territory_centroids: Dict[int, Any]
    _territory_counts: Dict[int, int]
    _nn_distances: Deque[float]
    _territory_tau: float
    _split_counter: int
    _merge_counter: int
    _config: Dict[str, Any]
    _next_territory_id: int
    _reward_ema: float
    _exploration_churn_window: int
    engrams: Dict[str, Any]
    frontier: Dict[str, Any]


__all__ = [
    "manager_to_dict",
    "populate_manager_from_dict",
    "save_json",
    "load_json",
]
