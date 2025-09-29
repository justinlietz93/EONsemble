#!/usr/bin/env python3
"""Nightly telemetry runner for the Void Dynamics learning system."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Optional

from _void_ops import bootstrap_memory, load_manager
from src.void_dynamics.telemetry import (
    AnomalyThresholds,
    ensure_reports_directory,
    generate_report,
    render_markdown_report,
)

DEFAULT_OUTPUT = Path("reports/void-telemetry-latest.json")
DEFAULT_MARKDOWN = Path("reports/void-telemetry-latest.md")
DEFAULT_ITERATIONS = 24
DEFAULT_BATCH_SIZE = 4
DEFAULT_DEGRADE_INTERVAL = 6
DEFAULT_TTL_FLOOR = 24
DEFAULT_HEAT_GAIN = 1.0
DEFAULT_TTL_BOOST = 120


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--snapshot",
        type=Path,
        help="Optional path to a persisted manager snapshot.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="Where to write the JSON telemetry report.",
    )
    parser.add_argument(
        "--markdown",
        type=Path,
        default=DEFAULT_MARKDOWN,
        help="Where to write the Markdown trend summary.",
    )
    parser.add_argument(
        "--iterations",
        type=int,
        default=DEFAULT_ITERATIONS,
        help="Number of reinforcement windows to simulate.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=DEFAULT_BATCH_SIZE,
        help="Number of memories to reinforce per window.",
    )
    parser.add_argument(
        "--degrade-interval",
        type=int,
        default=DEFAULT_DEGRADE_INTERVAL,
        help="Frequency (in windows) to inject degradation backpressure.",
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


def main() -> None:
    args = parse_args()
    manager = load_manager(args.snapshot)
    bootstrap_memory(manager)

    default_thresholds = AnomalyThresholds()
    thresholds = AnomalyThresholds(
        min_reward_ema=(
            args.reward_floor
            if args.reward_floor is not None
            else default_thresholds.min_reward_ema
        ),
        max_avg_heat_delta=(
            args.max_avg_heat_delta
            if args.max_avg_heat_delta is not None
            else default_thresholds.max_avg_heat_delta
        ),
        max_heat=(
            args.max_heat if args.max_heat is not None else default_thresholds.max_heat
        ),
    )

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

    ensure_reports_directory(args.output)
    args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")

    if args.markdown is not None:
        ensure_reports_directory(args.markdown)
        markdown = render_markdown_report(report)
        args.markdown.write_text(markdown, encoding="utf-8")

    anomalies = report.get("summary", {}).get("anomalies", [])
    if anomalies:
        print("Detected telemetry anomalies during nightly probe:", file=sys.stderr)
        for anomaly in anomalies:
            metric = anomaly.get("metric", "unknown")
            severity = anomaly.get("severity", "warning")
            sample = anomaly.get("sample", "summary")
            message = anomaly.get("message", "")
            print(f"- [{severity}] {metric} at {sample}: {message}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
