#!/usr/bin/env python3
"""Run the quarterly disaster-recovery drill and capture telemetry evidence."""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from _void_ops import bootstrap_memory, load_manager
from src.void_dynamics.telemetry import (
    AnomalyThresholds,
    ensure_reports_directory,
    generate_report,
    render_markdown_report,
)

DEFAULT_OUTPUT_DIR = Path("reports/drills")
DEFAULT_ITERATIONS = 8
DEFAULT_BATCH_SIZE = 4
DEFAULT_DEGRADE_INTERVAL = 3
DEFAULT_TTL_FLOOR = 24
DEFAULT_HEAT_GAIN = 0.9
DEFAULT_TTL_BOOST = 90


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--snapshot",
        type=Path,
        help="Optional path to a persisted manager snapshot used for the drill.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help="Directory where drill artifacts and logs will be written.",
    )
    parser.add_argument(
        "--iterations",
        type=int,
        default=DEFAULT_ITERATIONS,
        help="Number of reinforcement windows to simulate during the drill.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=DEFAULT_BATCH_SIZE,
        help="Number of memories to reinforce per window during the drill.",
    )
    parser.add_argument(
        "--degrade-interval",
        type=int,
        default=DEFAULT_DEGRADE_INTERVAL,
        help="Frequency (in windows) to degrade memories to mimic recovery load.",
    )
    parser.add_argument(
        "--ttl-floor",
        type=int,
        default=DEFAULT_TTL_FLOOR,
        help="TTL floor to apply during degradation events.",
    )
    parser.add_argument(
        "--heat-gain",
        type=float,
        default=DEFAULT_HEAT_GAIN,
        help="Heat gain applied during reinforcement windows.",
    )
    parser.add_argument(
        "--ttl-boost",
        type=int,
        default=DEFAULT_TTL_BOOST,
        help="TTL boost applied during reinforcement windows.",
    )
    parser.add_argument(
        "--reward-floor",
        type=float,
        help="Override the minimum acceptable final reward EMA before alerting.",
    )
    parser.add_argument(
        "--max-avg-heat-delta",
        type=float,
        help="Override the maximum acceptable change in average heat across the run.",
    )
    parser.add_argument(
        "--max-heat",
        type=float,
        help="Override the maximum acceptable instantaneous heat level.",
    )
    return parser.parse_args()


def _resolve_thresholds(args: argparse.Namespace) -> AnomalyThresholds:
    defaults = AnomalyThresholds()
    return AnomalyThresholds(
        min_reward_ema=(
            args.reward_floor
            if args.reward_floor is not None
            else defaults.min_reward_ema
        ),
        max_avg_heat_delta=(
            args.max_avg_heat_delta
            if args.max_avg_heat_delta is not None
            else defaults.max_avg_heat_delta
        ),
        max_heat=(args.max_heat if args.max_heat is not None else defaults.max_heat),
    )


def _write_history_entry(history_path: Path, entry: dict[str, object]) -> None:
    history_path.parent.mkdir(parents=True, exist_ok=True)
    with history_path.open("a", encoding="utf-8") as stream:
        stream.write(json.dumps(entry) + "\n")


def main() -> None:
    args = parse_args()
    thresholds = _resolve_thresholds(args)

    manager = load_manager(args.snapshot)
    bootstrap_memory(manager)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    output_dir = args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)
    run_dir = output_dir / timestamp
    run_dir.mkdir(parents=True, exist_ok=True)

    report = generate_report(
        manager,
        iterations=args.iterations,
        batch_size=args.batch_size,
        degrade_interval=args.degrade_interval,
        ttl_floor=args.ttl_floor,
        heat_gain=args.heat_gain,
        ttl_boost=args.ttl_boost,
        thresholds=thresholds,
    )

    telemetry_path = run_dir / "telemetry.json"
    markdown_path = run_dir / "telemetry.md"
    snapshot_path = run_dir / "post-drill-snapshot.json"
    log_path = run_dir / "drill-log.json"

    ensure_reports_directory(telemetry_path)
    telemetry_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    ensure_reports_directory(markdown_path)
    markdown = render_markdown_report(report)
    markdown_path.write_text(markdown, encoding="utf-8")

    # Persist the exercised manager state for auditability.
    if not manager.save_json(str(snapshot_path)):
        raise SystemExit("Failed to persist post-drill snapshot")

    summary = report.get("summary", {})
    anomalies = summary.get("anomalies", [])
    log_entry = {
        "timestamp": timestamp,
        "snapshot_source": str(args.snapshot) if args.snapshot else None,
        "status": summary.get("status", "unknown"),
        "anomaly_count": len(anomalies),
        "anomalies": anomalies,
        "thresholds": summary.get("thresholds", {}),
        "telemetry_report": str(telemetry_path),
        "telemetry_markdown": str(markdown_path),
        "post_drill_snapshot": str(snapshot_path),
    }
    log_path.write_text(json.dumps(log_entry, indent=2), encoding="utf-8")

    history_path = output_dir / "history.jsonl"
    _write_history_entry(history_path, log_entry)

    print("Drill completed with status:", log_entry["status"])
    if anomalies:
        print("Detected anomalies during drill:", file=sys.stderr)
        for anomaly in anomalies:
            metric = anomaly.get("metric", "unknown")
            severity = anomaly.get("severity", "warning")
            sample = anomaly.get("sample", "summary")
            message = anomaly.get("message", "")
            print(f"- [{severity}] {metric} at {sample}: {message}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
