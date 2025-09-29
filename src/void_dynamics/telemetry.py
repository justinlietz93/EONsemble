"""Telemetry helpers for the Void Dynamics learning system."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean
from typing import Any, Dict, Iterable, List, Sequence

from .manager import VoidMemoryManager


@dataclass
class TelemetrySample:
    """Snapshot of manager health collected during a probe run."""

    label: str
    tick: int
    count: int
    reward_ema: float
    avg_heat: float
    max_heat: float
    territories: int
    frontier_size: int
    split_counter: int
    merge_counter: int
    avg_confidence: float
    avg_novelty: float
    avg_boredom: float
    avg_mass: float
    events: Dict[str, int] = field(default_factory=dict)
    reinforced_ids: Sequence[str] = field(default_factory=list)


@dataclass(frozen=True)
class AnomalyThresholds:
    """Threshold configuration for telemetry anomaly detection."""

    min_reward_ema: float = 0.12
    max_avg_heat_delta: float = 2.5
    max_heat: float = 3.0


@dataclass
class TelemetryAnomaly:
    """Structured anomaly description surfaced from telemetry analysis."""

    metric: str
    severity: str
    message: str
    sample: str = "summary"


def _count_events(events: Iterable[Dict[str, Any]]) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for event in events:
        event_type = event.get("type", "unknown")
        counts[event_type] = counts.get(event_type, 0) + 1
    return counts


def detect_anomalies(
    samples: Sequence[TelemetrySample],
    summary: Dict[str, Any],
    thresholds: AnomalyThresholds,
) -> List[TelemetryAnomaly]:
    """Surface anomalies when telemetry metrics exceed configured thresholds."""

    anomalies: List[TelemetryAnomaly] = []
    if not samples:
        return anomalies

    final_reward = float(summary.get("final_reward_ema", 0.0))
    if final_reward < thresholds.min_reward_ema:
        anomalies.append(
            TelemetryAnomaly(
                metric="reward_ema",
                severity="critical",
                message=(
                    "Final reward EMA {:.4f} fell below floor {:.4f}".format(
                        final_reward, thresholds.min_reward_ema
                    )
                ),
                sample=samples[-1].label,
            )
        )

    heat_trend = summary.get("heat_trend", {})
    avg_delta = float(heat_trend.get("avg_delta", 0.0))
    if avg_delta > thresholds.max_avg_heat_delta:
        anomalies.append(
            TelemetryAnomaly(
                metric="avg_heat_delta",
                severity="warning",
                message=(
                    "Average heat delta {:.4f} exceeded limit {:.4f}".format(
                        avg_delta, thresholds.max_avg_heat_delta
                    )
                ),
                sample=samples[-1].label,
            )
        )

    for sample in samples:
        if sample.max_heat > thresholds.max_heat:
            severity = (
                "critical"
                if sample.max_heat > thresholds.max_heat * 1.2
                else "warning"
            )
            anomalies.append(
                TelemetryAnomaly(
                    metric="max_heat",
                    severity=severity,
                    message=(
                        "Max heat {:.4f} exceeded limit {:.4f}".format(
                            sample.max_heat, thresholds.max_heat
                        )
                    ),
                    sample=sample.label,
                )
            )

    return anomalies


def collect_sample(
    manager: VoidMemoryManager,
    *,
    label: str,
    events: Iterable[Dict[str, Any]],
    reinforced_ids: Sequence[str],
) -> TelemetrySample:
    """Collect a structured telemetry sample from the manager state."""

    snapshot = manager.to_dict()
    stats = manager.stats()
    memory_states = list(snapshot.get("mem", {}).values())
    heat_values = [state.get("heat", 0.0) for state in memory_states]

    if heat_values:
        avg_heat = mean(heat_values)
        max_heat = max(heat_values)
    else:
        avg_heat = 0.0
        max_heat = 0.0

    return TelemetrySample(
        label=label,
        tick=int(snapshot.get("tick", 0)),
        count=len(memory_states),
        reward_ema=float(snapshot.get("reward_ema", 0.0)),
        avg_heat=float(avg_heat),
        max_heat=float(max_heat),
        territories=len(snapshot.get("territory_centroids", {})),
        frontier_size=len(snapshot.get("frontier", {})),
        split_counter=int(snapshot.get("split_counter", 0)),
        merge_counter=int(snapshot.get("merge_counter", 0)),
        avg_confidence=float(stats.get("avg_confidence", 0.0)),
        avg_novelty=float(stats.get("avg_novelty", 0.0)),
        avg_boredom=float(stats.get("avg_boredom", 0.0)),
        avg_mass=float(stats.get("avg_mass", 0.0)),
        events=_count_events(events),
        reinforced_ids=list(reinforced_ids),
    )


def drive_manager_for_telemetry(
    manager: VoidMemoryManager,
    *,
    iterations: int = 24,
    batch_size: int = 4,
    degrade_interval: int = 6,
    ttl_floor: int = 24,
    heat_gain: float = 1.0,
    ttl_boost: int = 120,
) -> List[TelemetrySample]:
    """Run a deterministic probe that exercises reinforcement and degradation."""

    samples: List[TelemetrySample] = []
    if iterations <= 0:
        return samples

    for window in range(1, iterations + 1):
        snapshot = manager.to_dict()
        memory_ids = list(snapshot.get("mem", {}).keys())
        if not memory_ids:
            break
        current_batch_size = min(batch_size, len(memory_ids))
        row_ids = [
            memory_ids[(window + offset) % len(memory_ids)]
            for offset in range(current_batch_size)
        ]
        distances = [0.05 + 0.05 * offset for offset in range(current_batch_size)]
        payload = {"ids": [row_ids], "distances": [distances]}
        manager.reinforce(results=payload, heat_gain=heat_gain, ttl_boost=ttl_boost)

        if degrade_interval > 0 and window % degrade_interval == 0:
            manager.degrade(ids=row_ids, ttl_floor=ttl_floor)

        events = manager.consume_events()
        samples.append(
            collect_sample(
                manager,
                label=f"window-{window}",
                events=events,
                reinforced_ids=row_ids,
            )
        )

    return samples


def summarize_samples(
    samples: Sequence[TelemetrySample],
    thresholds: AnomalyThresholds | None = None,
) -> Dict[str, Any]:
    """Compute aggregate telemetry insights across all samples."""

    if not samples:
        summary: Dict[str, Any] = {
            "event_totals": {},
            "heat_trend": {"avg_delta": 0.0, "max_delta": 0.0},
            "final_reward_ema": 0.0,
            "final_frontier": 0,
            "territory_span": 0,
            "thresholds": asdict(thresholds) if thresholds is not None else {},
        }
        summary["anomalies"] = []
        summary["status"] = "ok"
        return summary

    event_totals: Dict[str, int] = {}
    for sample in samples:
        for event_type, count in sample.events.items():
            event_totals[event_type] = event_totals.get(event_type, 0) + count

    first = samples[0]
    last = samples[-1]
    heat_trend = {
        "avg_delta": last.avg_heat - first.avg_heat,
        "max_delta": last.max_heat - first.max_heat,
    }

    summary = {
        "event_totals": event_totals,
        "heat_trend": heat_trend,
        "final_reward_ema": last.reward_ema,
        "final_frontier": last.frontier_size,
        "territory_span": max(sample.territories for sample in samples),
        "thresholds": asdict(thresholds) if thresholds is not None else {},
    }

    if thresholds is not None:
        anomalies = detect_anomalies(samples, summary, thresholds)
        summary["anomalies"] = [anomaly.__dict__ for anomaly in anomalies]
        summary["status"] = "alert" if anomalies else "ok"
    else:
        summary["anomalies"] = []
        summary["status"] = "ok"

    return summary


def generate_report(
    manager: VoidMemoryManager,
    *,
    iterations: int = 24,
    batch_size: int = 4,
    degrade_interval: int = 6,
    ttl_floor: int = 24,
    heat_gain: float = 1.0,
    ttl_boost: int = 120,
    thresholds: AnomalyThresholds | None = None,
) -> Dict[str, Any]:
    """Produce a structured telemetry report covering the configured window."""

    if thresholds is None:
        thresholds = AnomalyThresholds()

    samples = drive_manager_for_telemetry(
        manager,
        iterations=iterations,
        batch_size=batch_size,
        degrade_interval=degrade_interval,
        ttl_floor=ttl_floor,
        heat_gain=heat_gain,
        ttl_boost=ttl_boost,
    )
    summary = summarize_samples(samples, thresholds)
    timestamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    return {
        "generated_at": timestamp,
        "config": {
            "iterations": iterations,
            "batch_size": batch_size,
            "degrade_interval": degrade_interval,
            "ttl_floor": ttl_floor,
            "heat_gain": heat_gain,
            "ttl_boost": ttl_boost,
        },
        "samples": [sample.__dict__ for sample in samples],
        "summary": summary,
    }


def render_markdown_report(report: Dict[str, Any]) -> str:
    """Render a Markdown table and summary from the telemetry report."""

    samples = report.get("samples", [])
    summary = report.get("summary", {})
    lines = ["# Void Dynamics Nightly Telemetry", ""]

    if samples:
        lines.append(
            "| Window | Tick | Memories | Reward EMA | Avg Heat | Max Heat | Territories | "
            "Frontier | Splits | Merges | Reinforce | Degrade | Prune |"
        )
        lines.append(
            "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |"
        )
        for sample in samples:
            events = sample.get("events", {})
            lines.append(
                "| {label} | {tick} | {count} | {reward:.4f} | {avg:.4f} | {maxh:.4f} | {territories} | {frontier} | "
                "{splits} | {merges} | {reinforce} | {degrade} | {prune} |".format(
                    label=sample.get("label", "-"),
                    tick=sample.get("tick", 0),
                    count=sample.get("count", 0),
                    reward=float(sample.get("reward_ema", 0.0)),
                    avg=float(sample.get("avg_heat", 0.0)),
                    maxh=float(sample.get("max_heat", 0.0)),
                    territories=sample.get("territories", 0),
                    frontier=sample.get("frontier_size", 0),
                    splits=sample.get("split_counter", 0),
                    merges=sample.get("merge_counter", 0),
                    reinforce=events.get("reinforce", 0),
                    degrade=events.get("degrade", 0),
                    prune=events.get("prune", 0),
                )
            )
        lines.append("")
    else:
        lines.append("_No telemetry samples were collected._")
        lines.append("")

    event_totals = summary.get("event_totals", {})
    lines.append("## Aggregates")
    lines.append("")
    lines.append(f"- Final reward EMA: {summary.get('final_reward_ema', 0.0):.4f}")
    heat_trend = summary.get("heat_trend", {})
    lines.append(
        "- Heat average delta: {avg:+.4f}, max delta: {maxd:+.4f}".format(
            avg=float(heat_trend.get("avg_delta", 0.0)),
            maxd=float(heat_trend.get("max_delta", 0.0)),
        )
    )
    lines.append(f"- Max territories observed: {summary.get('territory_span', 0)}")
    lines.append(f"- Frontier at end of run: {summary.get('final_frontier', 0)}")
    lines.append(f"- Status: {summary.get('status', 'unknown').upper()}")
    if event_totals:
        lines.append("- Event totals:")
        for key in sorted(event_totals):
            lines.append(f"  - {key}: {event_totals[key]}")
    else:
        lines.append("- Event totals: none")

    thresholds_dict = summary.get("thresholds", {})
    if thresholds_dict:
        lines.append("- Thresholds:")
        for key in sorted(thresholds_dict):
            lines.append(f"  - {key}: {thresholds_dict[key]}")

    lines.append("")
    lines.append("## Anomalies")
    lines.append("")
    anomalies = summary.get("anomalies", [])
    if anomalies:
        for anomaly in anomalies:
            lines.append(
                "- **{severity}** {metric} ({sample}): {message}".format(
                    severity=str(anomaly.get("severity", "warning")).upper(),
                    metric=anomaly.get("metric", "unknown"),
                    sample=anomaly.get("sample", "summary"),
                    message=anomaly.get("message", ""),
                )
            )
    else:
        lines.append("- None detected.")

    lines.append("")
    lines.append(
        "Generated {timestamp}".format(timestamp=report.get("generated_at", "unknown"))
    )

    return "\n".join(lines) + "\n"


def ensure_reports_directory(path: Path) -> None:
    """Ensure the parent directory for telemetry reports exists."""

    path.parent.mkdir(parents=True, exist_ok=True)


__all__ = [
    "TelemetrySample",
    "AnomalyThresholds",
    "TelemetryAnomaly",
    "detect_anomalies",
    "collect_sample",
    "drive_manager_for_telemetry",
    "summarize_samples",
    "generate_report",
    "render_markdown_report",
    "ensure_reports_directory",
]
