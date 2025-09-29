"""Data structures for the Void Dynamics Learning system."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


def clamp01(value: float) -> float:
    """Clamp a float to the inclusive range [0.0, 1.0]."""
    if value < 0.0:
        return 0.0
    if value > 1.0:
        return 1.0
    return value


@dataclass
class MemoryState:
    """Container for a single memory trace."""

    memory_id: str
    text: str
    embedding: Optional[List[float]] = None
    metadata: Optional[Dict[str, Any]] = None
    territory_id: Optional[int] = None
    ttl: int = 0
    last_touch_tick: int = 0
    use_count: int = 0
    mass: float = 1.0
    heat: float = 0.0
    confidence: float = 0.5
    novelty: float = 0.5
    boredom: float = 0.0
    inhibition: float = 0.0
    frontier_hits: int = 0
    pending_condense: bool = False

    def clamp_ranges(self) -> None:
        """Enforce range constraints on mutable attributes."""
        self.confidence = clamp01(self.confidence)
        self.novelty = clamp01(self.novelty)
        self.boredom = clamp01(self.boredom)
        if self.mass < 0.0:
            self.mass = 0.0
        if self.heat < 0.0:
            self.heat = 0.0
        if self.ttl < 0:
            self.ttl = 0
        if self.inhibition < 0.0:
            self.inhibition = 0.0

    def to_dict(self) -> Dict[str, Any]:
        """Serialize the memory state to a JSON friendly dictionary."""
        return {
            "text": self.text,
            "embedding": list(self.embedding) if self.embedding is not None else None,
            "metadata": self.metadata,
            "territory_id": self.territory_id,
            "ttl": self.ttl,
            "last_touch_tick": self.last_touch_tick,
            "use_count": self.use_count,
            "mass": self.mass,
            "heat": self.heat,
            "confidence": self.confidence,
            "novelty": self.novelty,
            "boredom": self.boredom,
            "inhibition": self.inhibition,
            "frontier_hits": self.frontier_hits,
            "pending_condense": self.pending_condense,
        }

    @classmethod
    def from_dict(cls, memory_id: str, data: Dict[str, Any]) -> "MemoryState":
        """Rehydrate a memory state from a dictionary payload."""
        embedding = data.get("embedding")
        if embedding is not None:
            embedding = [float(x) for x in embedding]
        state = cls(
            memory_id=memory_id,
            text=str(data.get("text", "")),
            embedding=embedding,
            metadata=data.get("metadata"),
            territory_id=data.get("territory_id"),
            ttl=int(data.get("ttl", 0)),
            last_touch_tick=int(data.get("last_touch_tick", 0)),
            use_count=int(data.get("use_count", 0)),
            mass=float(data.get("mass", 1.0)),
            heat=float(data.get("heat", 0.0)),
            confidence=float(data.get("confidence", 0.5)),
            novelty=float(data.get("novelty", 0.5)),
            boredom=float(data.get("boredom", 0.0)),
            inhibition=float(data.get("inhibition", 0.0)),
            frontier_hits=int(data.get("frontier_hits", 0)),
            pending_condense=bool(data.get("pending_condense", False)),
        )
        state.clamp_ranges()
        return state


__all__ = ["MemoryState", "clamp01"]
